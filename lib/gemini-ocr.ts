import { parseVocabLine, parseVocabLines } from "@/lib/parse-vocab";
import type { ParsedRow } from "@/lib/types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const PROMPT = `You are reading a photographed Japanese vocabulary textbook page.
The page lists headwords (kanji, sometimes with okurigana, or kana-only words), a hiragana or katakana reading, and a Myanmar (Burmese) meaning.

Extract every vocabulary row in reading order, top to bottom. Skip titles, page numbers, lesson numbers, and column headers such as 単語, 読み, or 意味.

Return JSON with this shape:
{"rows":[{"kanji":"","reading":"","meaning":""}]}

Rules:
- kanji is the headword exactly as printed, including okurigana. Example: 申し込む.
- reading is only the pronunciation in hiragana or katakana. Do not repeat the kanji inside the reading.
- meaning is the Myanmar translation in Myanmar script. Do not translate it into English.
- If one field on a real row is unreadable, use an empty string for that field.
- Do not invent words that are not printed on the page.`;

export function geminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return DEFAULT_GEMINI_MODEL;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kanji: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["kanji", "reading", "meaning"],
      },
    },
  },
  required: ["rows"],
};

export function buildGeminiRequest(imageBase64: string, mimeType: string, model = DEFAULT_GEMINI_MODEL) {
  return {
    model,
    store: false,
    input: [
      { type: "text", text: PROMPT },
      { type: "image", data: imageBase64, mime_type: mimeType },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: RESPONSE_SCHEMA,
    },
    generation_config: {
      max_output_tokens: 8192,
      ...(model.startsWith("gemini-3") ? { thinking_level: "minimal" } : {}),
    },
  };
}

export function rowsFromGemini(payload: unknown): { rows: ParsedRow[]; rawText: string; error?: string } {
  if (!isRecord(payload)) return { rows: [], rawText: "", error: "Gemini returned an empty response." };
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return { rows: [], rawText: "", error: payload.error.message };
  }

  const blocked = blockReason(payload);
  const text = extractText(payload);
  if (!text) {
    if (blocked) return { rows: [], rawText: "", error: blocked };
    return { rows: [], rawText: "", error: "Gemini returned no text for this photo." };
  }

  const structured = parseModelJson(text);
  if (structured) return structured;

  const rows = parseVocabLines(text.split(/\r?\n/));
  return { rows, rawText: text, error: blocked };
}

function extractText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  const fromSteps = textFromSteps(payload.steps);
  if (fromSteps) return fromSteps;

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const chunks: string[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) continue;
    for (const part of candidate.content.parts) {
      if (isRecord(part) && typeof part.text === "string" && part.text.trim()) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function textFromSteps(steps: unknown): string {
  if (!Array.isArray(steps)) return "";
  const chunks: string[] = [];
  for (const step of steps) {
    if (!isRecord(step) || (step.type && step.type !== "model_output")) continue;
    const content = step.content;
    if (typeof content === "string" && content.trim()) {
      chunks.push(content.trim());
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (isRecord(part) && (part.type === undefined || part.type === "text") && typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }
  return chunks.join("\n").trim();
}

function blockReason(payload: Record<string, unknown>): string | undefined {
  const feedback = isRecord(payload.promptFeedback) ? payload.promptFeedback : null;
  if (feedback && typeof feedback.blockReason === "string" && feedback.blockReason !== "BLOCK_REASON_UNSPECIFIED") {
    return `Gemini blocked the photo (${feedback.blockReason}).`;
  }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates.find(isRecord);
  if (first && (first.finishReason === "SAFETY" || first.finishReason === "PROHIBITED_CONTENT")) {
    return "Gemini blocked the photo.";
  }
  return undefined;
}

function parseModelJson(text: string): { rows: ParsedRow[]; rawText: string } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  try {
    return normalizeModelValue(JSON.parse(candidate.slice(start)) as unknown, text);
  } catch {
    return null;
  }
}

function normalizeModelValue(value: unknown, rawText: string): { rows: ParsedRow[]; rawText: string } | null {
  const list = vocabList(value);
  if (!list) return null;
  const rows: ParsedRow[] = [];
  for (const item of list) {
    const row = tidyRow(item);
    if (row) rows.push(row);
    if (rows.length >= 80) break;
  }
  const printed =
    isRecord(value) && typeof value.rawText === "string" && value.rawText.trim() ? value.rawText.trim() : rawText;
  return { rows, rawText: printed };
}

function vocabList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.entries)) return value.entries;
  if (Array.isArray(value.cards)) return value.cards;
  return null;
}

function tidyRow(value: unknown): ParsedRow | null {
  if (!isRecord(value)) return null;
  const kanji = field(value, ["kanji", "headword", "word", "term"]);
  const reading = field(value, ["reading", "hiragana", "yomi", "pronunciation"]);
  const meaning = field(value, ["meaning", "myanmar", "translation", "definition"]);
  let row: ParsedRow = {
    kanji: clip(kanji, 40),
    reading: clip(reading, 60),
    meaning: clip(meaning, 80),
  };

  if (row.kanji && !row.reading) {
    const split = parseVocabLine(`${row.kanji} ${row.meaning}`.trim());
    if (split?.kanji && split.reading) {
      row = { kanji: split.kanji, reading: split.reading, meaning: row.meaning || split.meaning };
    }
  }

  if (!row.kanji && !row.reading && !row.meaning) return null;
  if (!row.kanji && !row.reading) return null;
  return row;
}

function field(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function clip(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
