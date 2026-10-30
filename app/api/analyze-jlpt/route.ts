import { geminiModelChain, shouldTryNextModel } from "@/lib/gemini-ocr";
import {
  buildJlptGeminiRequest,
  geminiErrorMessage,
  nextGeminiAttempt,
  questionsFromGemini,
  type GeminiAttempt,
} from "@/lib/gemini-jlpt";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64_CHARS = 6_000_000;

export type JlptAnalyzeSuccess = {
  ok: true;
  source: "gemini";
  message: string;
  questions: JlptQuestion[];
  rawText: string;
};

export type JlptAnalyzeFailure = {
  ok: false;
  error: string;
};

function geminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

function json(body: JlptAnalyzeSuccess | JlptAnalyzeFailure | { configured: boolean }, status = 200) {
  return Response.json(body, { status });
}

function cleanBase64(input: string): string {
  const marker = "base64,";
  const index = input.indexOf(marker);
  return (index >= 0 ? input.slice(index + marker.length) : input).replace(/\s/g, "");
}

function safeMessage(message: string): string {
  return message.replace(/key=[^&\s]+/gi, "key=…").slice(0, 240);
}

async function readGeminiBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function readImageFromRequest(request: Request): Promise<
  | { ok: true; imageBase64: string; mimeType: string }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, error: "Could not read the uploaded file.", status: 400 };
    }

    const file = form.get("image") ?? form.get("file") ?? form.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a photo first.", status: 400 };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "That file isn't an image.", status: 415 };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buffer.toString("base64");
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return { ok: false, error: "That photo is too large. Try a closer crop.", status: 413 };
    }
    return { ok: true, imageBase64, mimeType: file.type || "image/jpeg" };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Send the photo as JSON or multipart form data.", status: 400 };
  }

  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send the photo as JSON or multipart form data.", status: 400 };
  }

  const record = body as { imageBase64?: unknown; mimeType?: unknown };
  if (typeof record.imageBase64 !== "string" || record.imageBase64.trim().length === 0) {
    return { ok: false, error: "Choose a photo first.", status: 400 };
  }

  const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return { ok: false, error: "That file isn't an image.", status: 415 };
  }

  const imageBase64 = cleanBase64(record.imageBase64);
  if (!/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    return { ok: false, error: "The photo data was unreadable.", status: 400 };
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return { ok: false, error: "That photo is too large. Try a closer crop.", status: 413 };
  }

  return { ok: true, imageBase64, mimeType };
}

export async function GET() {
  return json({ configured: Boolean(geminiKey()) });
}

export async function POST(request: Request) {
  const image = await readImageFromRequest(request);
  if (!image.ok) {
    return json({ ok: false, error: image.error }, image.status);
  }

  const key = geminiKey();
  if (!key) {
    return json(
      {
        ok: false,
        error: "No Gemini API key is set. Add GEMINI_API_KEY to .env.local, then restart the dev server.",
      },
      503,
    );
  }

  const models = geminiModelChain(process.env.GEMINI_MODEL);
  let lastMessage = "Gemini did not respond. Check the key and try the photo again.";

  for (const model of models) {
    let attempt: GeminiAttempt | "next-model" = { thinking: true, structured: true };
    for (let tryIndex = 0; tryIndex < 3 && attempt !== "next-model"; tryIndex += 1) {
      const current = attempt;
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(
            buildJlptGeminiRequest(image.imageBase64, image.mimeType, model, {
              thinking: current.thinking,
              structured: current.structured,
            }),
          ),
          signal: AbortSignal.timeout(45_000),
        });

        const payload = await readGeminiBody(response);
        if (!response.ok) {
          const message = geminiErrorMessage(payload, response.status);
          console.error("Gemini JLPT analyze failed", model, safeMessage(message));
          lastMessage = message;
          const next = nextGeminiAttempt(response.status, message, current);
          if (next === "auth") {
            return json(
              {
                ok: false,
                error:
                  "The Gemini API key was rejected. Check GEMINI_API_KEY in .env.local, then restart the dev server.",
              },
              502,
            );
          }
          if (next === "billing") {
            return json(
              {
                ok: false,
                error: "This Gemini key has no credits left. Add billing in Google AI Studio, then try again.",
              },
              502,
            );
          }
          if (next === "stop") {
            return json({ ok: false, error: `Gemini could not analyze the paper. ${safeMessage(message)}` }, 502);
          }
          attempt = next;
          continue;
        }

        const parsed = questionsFromGemini(payload);
        if (parsed.error && parsed.questions.length === 0) {
          console.error("Gemini JLPT analyze failed", model, safeMessage(parsed.error));
          lastMessage = parsed.error;
          const next = nextGeminiAttempt(response.status, parsed.error, current);
          if (next === "auth" || next === "billing" || next === "stop") {
            return json(
              { ok: false, error: `Gemini could not analyze the paper. ${safeMessage(parsed.error)}` },
              502,
            );
          }
          attempt = next;
          continue;
        }

        const success: JlptAnalyzeSuccess = {
          ok: true,
          source: "gemini",
          message: parsed.questions.length
            ? `Extracted ${parsed.questions.length} Mondai 4–6 question${parsed.questions.length === 1 ? "" : "s"}.`
            : "The photo was read, but no Mondai 4–6 questions were found.",
          questions: parsed.questions,
          rawText: parsed.rawText,
        };
        return json(success);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The request failed.";
        console.error("Gemini JLPT analyze failed", model, safeMessage(message));
        lastMessage = message;
        break;
      }
    }
  }

  const busy = shouldTryNextModel(503, lastMessage);
  return json(
    {
      ok: false,
      error: busy
        ? "Gemini is busy right now. Try the photo again in a moment."
        : `Gemini could not analyze the paper. ${safeMessage(lastMessage)}`,
    },
    503,
  );
}
