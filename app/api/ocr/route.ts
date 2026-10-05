import { MOCK_TEXTBOOK_PAGE } from "@/lib/sample-data";
import { parseVocabLines, rowsFromVision } from "@/lib/parse-vocab";
import type { OcrFailure, OcrSuccess } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BASE64_CHARS = 6_000_000;

function visionKey(): string | null {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GOOGLE_VISION_API_KEY;
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
  return json({ configured: Boolean(visionKey()) });
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

  const key = visionKey();
  if (!key) {
    const rows = parseVocabLines(MOCK_TEXTBOOK_PAGE.split("\n"));
    const payload: OcrSuccess = {
      ok: true,
      source: "mock",
      message:
        "No Vision API key is set, so this is a practice page rather than your photo. Edit every row to match your book, or add GOOGLE_CLOUD_VISION_API_KEY to read the scan.",
      rows,
      rawText: MOCK_TEXTBOOK_PAGE,
    };
    return json(payload);
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["ja", "my"] },
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
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
          : `Vision returned ${response.status}.`;
      console.error("Vision OCR failed", safeMessage(message));
      return json(
        {
          ok: false,
          error: `Google Vision couldn't read the page. ${safeMessage(message)}`,
        },
        502,
      );
    }

    const parsed = rowsFromVision(payload);
    if (parsed.error) {
      console.error("Vision OCR failed", safeMessage(parsed.error));
      return json(
        { ok: false, error: `Google Vision couldn't read the page. ${safeMessage(parsed.error)}` },
        502,
      );
    }

    const success: OcrSuccess = {
      ok: true,
      source: "vision",
      message: parsed.rows.length
        ? `Read ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} from the photo. Correct anything that looks off before saving.`
        : "The photo was read, but no vocabulary rows were found. Type them in below.",
      rows: parsed.rows,
      rawText: parsed.rawText,
    };
    return json(success);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    console.error("Vision OCR failed", safeMessage(message));
    return json(
      { ok: false, error: "Google Vision didn't respond. Check the key and try the photo again." },
      502,
    );
  }
}
