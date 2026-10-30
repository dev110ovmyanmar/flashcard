import {
  callJlptGenerateContent,
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  jlptGeminiModelChain,
  normalizeImageMimeType,
  questionsFromGemini,
  shouldTryNextJlptModel,
} from "@/lib/gemini-jlpt";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reject oversized uploads; client compresses JLPT photos well under this. */
const MAX_BASE64_CHARS = 1_200_000;

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

function safeMessage(message: string): string {
  return message.replace(/key=[^&\s]+/gi, "key=…").slice(0, 400);
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
    return {
      ok: true,
      imageBase64,
      mimeType: normalizeImageMimeType(file.type || "image/jpeg"),
    };
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

  const mimeType = normalizeImageMimeType(
    typeof record.mimeType === "string" ? record.mimeType : "image/jpeg",
  );
  if (!mimeType.startsWith("image/")) {
    return { ok: false, error: "That file isn't an image.", status: 415 };
  }

  const imageBase64 = cleanImageBase64(record.imageBase64);
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
    console.error("[Gemini JLPT] missing API key — set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    return json(
      {
        ok: false,
        error: "No Gemini API key is set. Add GEMINI_API_KEY to .env.local, then restart the dev server.",
      },
      503,
    );
  }

  console.info("[Gemini JLPT] API key loaded", { length: key.length, prefix: `${key.slice(0, 4)}…` });

  const models = jlptGeminiModelChain(process.env.GEMINI_MODEL || process.env.JLPT_GEMINI_MODEL);
  let lastMessage = "Gemini did not respond. Check the key and try the photo again.";

  for (const modelName of models) {
    for (const structured of [true, false]) {
      const result = await callJlptGenerateContent({
        apiKey: key,
        model: modelName,
        imageBase64: image.imageBase64,
        mimeType: image.mimeType,
        structured,
      });

      if (!result.ok) {
        lastMessage = result.error;
        console.error("[Gemini JLPT] attempt failed", {
          model: modelName,
          structured,
          kind: result.kind,
          message: safeMessage(result.error),
        });

        if (result.kind === "auth" || isGeminiAuthError(result.error)) {
          return json(
            {
              ok: false,
              error:
                "The Gemini API key was rejected. Check GEMINI_API_KEY in .env.local, then restart the dev server.",
            },
            502,
          );
        }
        if (result.kind === "billing" || isGeminiBillingError(result.error)) {
          return json(
            {
              ok: false,
              error: "This Gemini key has no credits left. Add billing in Google AI Studio, then try again.",
            },
            502,
          );
        }
        if (result.kind === "timeout" || result.kind === "network" || isNetworkOrTimeoutError(result.error)) {
          // Try the next model once network recovers / alternate endpoint path.
          break;
        }
        if (structured && (result.kind === "parse" || isStructuredOutputError(result.error))) {
          continue;
        }
        if (shouldTryNextJlptModel(result.error)) {
          break;
        }
        return json({ ok: false, error: `Gemini could not analyze the paper. ${safeMessage(result.error)}` }, 502);
      }

      const parsed = questionsFromGemini(result.payload);
      const success: JlptAnalyzeSuccess = {
        ok: true,
        source: "gemini",
        message: parsed.questions.length
          ? `Extracted ${parsed.questions.length} Mondai 4–6 question${parsed.questions.length === 1 ? "" : "s"}.`
          : "The photo was read, but no Mondai 4–6 questions were found.",
        questions: parsed.questions,
        rawText: parsed.rawText || result.rawText,
      };
      return json(success);
    }
  }

  const networkish = isNetworkOrTimeoutError(lastMessage);
  return json(
    {
      ok: false,
      error: networkish
        ? safeMessage(lastMessage)
        : shouldTryNextJlptModel(lastMessage)
          ? "Gemini is busy right now. Try the photo again in a moment."
          : `Gemini could not analyze the paper. ${safeMessage(lastMessage)}`,
    },
    503,
  );
}
