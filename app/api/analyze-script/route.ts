import {
  extractPageKind,
  parseJsonRoot,
  sectionMismatchError,
} from "@/lib/analyzer-section";
import {
  callScriptGenerateContent,
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  normalizeImageMimeType,
  normalizeScriptText,
  shouldTryNextScriptModel,
  scriptGeminiModelChain,
} from "@/lib/gemini-script";
import type { ScriptGrammarItem, ScriptVocabItem } from "@/src/constants/scriptPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SCRIPT_CHARS = 28_000;
const MAX_BASE64_CHARS = 1_200_000;

export type ScriptAnalyzeSuccess = {
  ok: true;
  source: "gemini";
  message: string;
  script_text: string;
  translation_burmese: string;
  vocabulary: ScriptVocabItem[];
  grammar: ScriptGrammarItem[];
  rawText: string;
};

export type ScriptAnalyzeFailure = {
  ok: false;
  error: string;
};

type ScriptInput =
  | { kind: "text"; scriptText: string }
  | { kind: "image"; imageBase64: string; mimeType: string };

function geminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

function json(body: ScriptAnalyzeSuccess | ScriptAnalyzeFailure | { configured: boolean }, status = 200) {
  return Response.json(body, { status });
}

function safeMessage(message: string): string {
  return message.replace(/key=[^&\s]+/gi, "key=…").slice(0, 400);
}

function validateImageBase64(imageBase64: string, mimeTypeRaw: string): ScriptInput | { error: string; status: number } {
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

async function readScriptFromRequest(
  request: Request,
): Promise<{ ok: true; input: ScriptInput } | { ok: false; error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, error: "Could not read the uploaded file.", status: 400 };
    }

    const file = form.get("image") ?? form.get("script") ?? form.get("file") ?? form.get("photo") ?? form.get("text");
    if (file instanceof File && file.size > 0) {
      if (file.type.startsWith("image/")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const checked = validateImageBase64(buffer.toString("base64"), file.type || "image/jpeg");
        if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
        return { ok: true, input: checked };
      }

      const text = normalizeScriptText(await file.text());
      if (!text) return { ok: false, error: "That file has no readable text.", status: 400 };
      if (text.length > MAX_SCRIPT_CHARS) {
        return { ok: false, error: "That script is too long. Paste a shorter section.", status: 413 };
      }
      return { ok: true, input: { kind: "text", scriptText: text } };
    }

    const raw = form.get("scriptText") ?? form.get("text");
    if (typeof raw === "string" && raw.trim()) {
      const text = normalizeScriptText(raw);
      if (text.length > MAX_SCRIPT_CHARS) {
        return { ok: false, error: "That script is too long. Paste a shorter section.", status: 413 };
      }
      return { ok: true, input: { kind: "text", scriptText: text } };
    }

    return { ok: false, error: "Paste a script or choose a photo first.", status: 400 };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Send the script as JSON or multipart form data.", status: 400 };
  }

  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Send the script as JSON or multipart form data.", status: 400 };
  }

  const record = body as {
    scriptText?: unknown;
    text?: unknown;
    imageBase64?: unknown;
    mimeType?: unknown;
  };

  if (typeof record.imageBase64 === "string" && record.imageBase64.trim()) {
    const checked = validateImageBase64(
      record.imageBase64,
      typeof record.mimeType === "string" ? record.mimeType : "image/jpeg",
    );
    if ("error" in checked) return { ok: false, error: checked.error, status: checked.status };
    return { ok: true, input: checked };
  }

  const raw =
    typeof record.scriptText === "string"
      ? record.scriptText
      : typeof record.text === "string"
        ? record.text
        : "";

  const scriptText = normalizeScriptText(raw);
  if (!scriptText) {
    return { ok: false, error: "Paste a script or choose a photo first.", status: 400 };
  }
  if (scriptText.length > MAX_SCRIPT_CHARS) {
    return { ok: false, error: "That script is too long. Paste a shorter section.", status: 413 };
  }

  return { ok: true, input: { kind: "text", scriptText } };
}

export async function GET() {
  return json({ configured: Boolean(geminiKey()) });
}

export async function POST(request: Request) {
  const script = await readScriptFromRequest(request);
  if (!script.ok) {
    return json({ ok: false, error: script.error }, script.status);
  }

  const key = geminiKey();
  if (!key) {
    console.error("[Gemini Script] missing API key — set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    return json(
      {
        ok: false,
        error: "No Gemini API key is set. Add GEMINI_API_KEY to .env.local, then restart the dev server.",
      },
      503,
    );
  }

  console.info("[Gemini Script] API key loaded", { length: key.length, prefix: `${key.slice(0, 4)}…` });

  const models = scriptGeminiModelChain(process.env.GEMINI_MODEL || process.env.SCRIPT_GEMINI_MODEL);
  let lastMessage = "Gemini did not respond. Check the key and try again.";

  for (const modelName of models) {
    for (const structured of [true, false]) {
      const result = await callScriptGenerateContent({
        apiKey: key,
        model: modelName,
        structured,
        ...(script.input.kind === "text"
          ? { scriptText: script.input.scriptText }
          : { imageBase64: script.input.imageBase64, mimeType: script.input.mimeType }),
      });

      if (!result.ok) {
        lastMessage = result.error;
        console.error("[Gemini Script] attempt failed", {
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
          break;
        }
        if (structured && (result.kind === "parse" || isStructuredOutputError(result.error))) {
          continue;
        }
        if (shouldTryNextScriptModel(result.error)) {
          break;
        }
        return json(
          { ok: false, error: `Gemini could not analyze the script. ${safeMessage(result.error)}` },
          502,
        );
      }

      const pageKind =
        extractPageKind(result.payload) ?? extractPageKind(parseJsonRoot(result.rawText));
      const mismatch = sectionMismatchError("script", pageKind);
      if (mismatch) {
        return json({ ok: false, error: mismatch }, 422);
      }

      const vocabCount = result.payload.vocabulary.length;
      const grammarCount = result.payload.grammar.length;
      const scriptText =
        result.payload.script_text.trim() ||
        (script.input.kind === "text" ? script.input.scriptText : "");
      const success: ScriptAnalyzeSuccess = {
        ok: true,
        source: "gemini",
        message:
          vocabCount || grammarCount
            ? `Found ${vocabCount} vocab · ${grammarCount} grammar point${grammarCount === 1 ? "" : "s"}.`
            : "The text was read. No vocabulary or grammar points were found.",
        script_text: scriptText,
        translation_burmese: result.payload.translation_burmese,
        vocabulary: result.payload.vocabulary,
        grammar: result.payload.grammar,
        rawText: result.rawText,
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
        : shouldTryNextScriptModel(lastMessage)
          ? "Gemini is busy right now. Try again in a moment."
          : `Gemini could not analyze the script. ${safeMessage(lastMessage)}`,
    },
    503,
  );
}
