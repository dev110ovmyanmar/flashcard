import {
  analyzeJlptExamPaper,
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  jlptGeminiModelChain,
  JLPT_MAX_TEXT_CHARS,
  normalizeImageMimeType,
  normalizeJlptTextInput,
  shouldTryNextJlptModel,
} from "@/lib/gemini-jlpt";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow Mondai batch continuation on long exam pages (Vercel / Node hosts). */
export const maxDuration = 300;

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

type JlptInput =
  | { kind: "image"; imageBase64: string; mimeType: string }
  | { kind: "text"; textInput: string };

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

function validateImageBase64(
  imageBase64: string,
  mimeTypeRaw: string,
): JlptInput | { error: string; status: number } {
  const mimeType = normalizeImageMimeType(mimeTypeRaw || "image/jpeg");
  if (!mimeType.startsWith("image/")) {
    return { error: "That file isn't an image.", status: 415 };
  }
  const cleaned = cleanImageBase64(imageBase64);
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleaned)) {
    return { error: "The photo data was unreadable.", status: 400 };
  }
  if (cleaned.length > MAX_BASE64_CHARS) {
    return { error: "That photo is too large. Try a closer crop.", status: 413 };
  }
  return { kind: "image", imageBase64: cleaned, mimeType };
}

function validateTextInput(raw: string): JlptInput | { error: string; status: number } {
  const textInput = normalizeJlptTextInput(raw);
  if (!textInput) {
    return { error: "Paste some Japanese text first.", status: 400 };
  }
  if (textInput.length > JLPT_MAX_TEXT_CHARS) {
    return { error: "That text is too long. Paste a shorter section.", status: 413 };
  }
  return { kind: "text", textInput };
}

async function readInputFromRequest(
  request: Request,
): Promise<{ ok: true; input: JlptInput } | { ok: false; error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, error: "Could not read the uploaded file.", status: 400 };
    }

    const rawText = form.get("textInput") ?? form.get("text");
    if (typeof rawText === "string" && rawText.trim()) {
      const checked = validateTextInput(rawText);
      if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
      return { ok: true, input: checked };
    }

    const file = form.get("image") ?? form.get("file") ?? form.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a photo or paste text first.", status: 400 };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "That file isn't an image.", status: 415 };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checked = validateImageBase64(buffer.toString("base64"), file.type || "image/jpeg");
    if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
    return { ok: true, input: checked };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Send the photo or text as JSON or multipart form data.", status: 400 };
  }

  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send the photo or text as JSON or multipart form data.", status: 400 };
  }

  const record = body as {
    imageBase64?: unknown;
    mimeType?: unknown;
    textInput?: unknown;
    text?: unknown;
  };

  if (typeof record.textInput === "string" && record.textInput.trim()) {
    const checked = validateTextInput(record.textInput);
    if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
    return { ok: true, input: checked };
  }

  if (typeof record.text === "string" && record.text.trim()) {
    const checked = validateTextInput(record.text);
    if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
    return { ok: true, input: checked };
  }

  if (typeof record.imageBase64 !== "string" || record.imageBase64.trim().length === 0) {
    return { ok: false, error: "Choose a photo or paste text first.", status: 400 };
  }

  const checked = validateImageBase64(
    record.imageBase64,
    typeof record.mimeType === "string" ? record.mimeType : "image/jpeg",
  );
  if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
  return { ok: true, input: checked };
}

export async function GET() {
  return json({ configured: Boolean(geminiKey()) });
}

export async function POST(request: Request) {
  const parsed = await readInputFromRequest(request);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.error }, parsed.status);
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

  console.info("[Gemini JLPT] API key loaded", {
    length: key.length,
    prefix: `${key.slice(0, 4)}…`,
    inputKind: parsed.input.kind,
  });

  const models = jlptGeminiModelChain(process.env.GEMINI_MODEL || process.env.JLPT_GEMINI_MODEL);
  let lastMessage = "Gemini did not respond. Check the key and try again.";

  for (const modelName of models) {
    const result = await analyzeJlptExamPaper({
      apiKey: key,
      model: modelName,
      ...(parsed.input.kind === "text"
        ? { textInput: parsed.input.textInput }
        : { imageBase64: parsed.input.imageBase64, mimeType: parsed.input.mimeType }),
    });

    if (!result.ok) {
      lastMessage = result.error;
      console.error("[Gemini JLPT] attempt failed", {
        model: modelName,
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
        continue;
      }
      if (shouldTryNextJlptModel(result.error)) {
        continue;
      }
      return json({ ok: false, error: `Gemini could not analyze the paper. ${safeMessage(result.error)}` }, 502);
    }

    const success: JlptAnalyzeSuccess = {
      ok: true,
      source: "gemini",
      message: result.questions.length
        ? `Extracted ${result.questions.length} Mondai 1–6 question${result.questions.length === 1 ? "" : "s"}.`
        : parsed.input.kind === "text"
          ? "The text was read, but no Mondai 1–6 questions were found."
          : "The photo was read, but no Mondai 1–6 questions were found.",
      questions: result.questions,
      rawText: result.rawText,
    };
    return json(success);
  }

  const networkish = isNetworkOrTimeoutError(lastMessage);
  return json(
    {
      ok: false,
      error: networkish
        ? safeMessage(lastMessage)
        : shouldTryNextJlptModel(lastMessage)
          ? "Gemini is busy right now. Try again in a moment."
          : `Gemini could not analyze the paper. ${safeMessage(lastMessage)}`,
    },
    503,
  );
}
