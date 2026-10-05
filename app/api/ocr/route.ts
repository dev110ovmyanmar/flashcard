import { buildGeminiRequest, geminiModelName, rowsFromGemini } from "@/lib/gemini-ocr";
import { parseVocabLines } from "@/lib/parse-vocab";
import { MOCK_TEXTBOOK_PAGE } from "@/lib/sample-data";
import type { OcrFailure, OcrSuccess } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64_CHARS = 6_000_000;

function geminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

function json(body: OcrSuccess | OcrFailure | { configured: boolean }, status = 200) {
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

export async function GET() {
  return json({ configured: Boolean(geminiKey()) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Send the photo as JSON." }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return json({ ok: false, error: "Send the photo as JSON." }, 400);
  }

  const record = body as { imageBase64?: unknown; mimeType?: unknown };
  if (typeof record.imageBase64 !== "string" || record.imageBase64.trim().length === 0) {
    return json({ ok: false, error: "Choose a photo first." }, 400);
  }

  const mimeType = typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return json({ ok: false, error: "That file isn't an image." }, 415);
  }

  const imageBase64 = cleanBase64(record.imageBase64);
  if (!/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    return json({ ok: false, error: "The photo data was unreadable." }, 400);
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return json({ ok: false, error: "That photo is too large. Try a closer crop." }, 413);
  }

  const key = geminiKey();
  if (!key) {
    const rows = parseVocabLines(MOCK_TEXTBOOK_PAGE.split("\n"));
    const payload: OcrSuccess = {
      ok: true,
      source: "mock",
      message:
        "No Gemini API key is set, so this is a practice page rather than your photo. Edit every row to match your book, or add GEMINI_API_KEY to read the scan.",
      rows,
      rawText: MOCK_TEXTBOOK_PAGE,
    };
    return json(payload);
  }

  const model = geminiModelName(process.env.GEMINI_MODEL);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(buildGeminiRequest(imageBase64, mimeType, model)),
        signal: AbortSignal.timeout(45_000),
      },
    );

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
          ? payload.error.message
          : `Gemini returned ${response.status}.`;
      console.error("Gemini OCR failed", safeMessage(message));
      return json(
        {
          ok: false,
          error: `Gemini could not read the page. ${safeMessage(message)}`,
        },
        502,
      );
    }

    const parsed = rowsFromGemini(payload);
    if (parsed.error && parsed.rows.length === 0) {
      console.error("Gemini OCR failed", safeMessage(parsed.error));
      return json(
        { ok: false, error: `Gemini could not read the page. ${safeMessage(parsed.error)}` },
        502,
      );
    }

    const success: OcrSuccess = {
      ok: true,
      source: "gemini",
      message: parsed.rows.length
        ? `Read ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} from the photo. Correct anything that looks off before saving.`
        : "The photo was read, but no vocabulary rows were found. Type them in below.",
      rows: parsed.rows,
      rawText: parsed.rawText,
    };
    return json(success);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    console.error("Gemini OCR failed", safeMessage(message));
    return json(
      { ok: false, error: "Gemini did not respond. Check the key and try the photo again." },
      502,
    );
  }
}
