import { parseVocabLine, parseVocabLines } from "@/lib/parse-vocab";
import type { ParsedRow } from "@/lib/types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Fast models first. Slower Flash models are only used when an earlier one is busy or missing. */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
] as const;

const PROMPT = `Read this Japanese vocabulary page from top to bottom.
Each row is a headword (keep okurigana, for example 申し込む), a hiragana or katakana reading, and a Myanmar meaning.
Skip titles, numbers, and headers.
Return {"rows":[{"kanji":"","reading":"","meaning":""}]}.
Do not translate into English or invent words. Use an empty string for an unreadable field.`;

export function geminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return DEFAULT_GEMINI_MODEL;
}

export function geminiModelChain(preferred: string | undefined): string[] {
  const primary = geminiModelName(preferred);
  return [primary, ...GEMINI_FALLBACK_MODELS.filter((model) => model !== primary)];
}

export type GeminiAttempt = { thinking: boolean; structured: boolean };

export function geminiErrorMessage(payload: unknown, status: number): string {
  const message = findErrorMessage(unwrapGeminiPayload(payload));
  if (message) return message;
  const snippet = payloadSnippet(payload);
  if (snippet) return snippet;
  return `Gemini returned ${status}.`;
}

export function isGeminiAuthError(message: string): boolean {
  return /api key not valid|api_key_invalid|permission denied|unregistered callers|consumer identity|authentication/i.test(
    message,
  );
}

export function isGeminiModelError(message: string): boolean {
  return /thinking level|not supported for this model|no longer available|not found|unknown model|does not exist|not available to new users/i.test(
    message,
  );
}

export function isGeminiShapeError(message: string): boolean {
  return /unknown parameter|response_format|response format|json schema|invalid schema|mime_type|additional propert/i.test(
    message,
  );
}

export function shouldTryNextModel(status: number, message: string): boolean {
  if (isGeminiAuthError(message)) return false;
  if (isGeminiModelError(message)) return true;
  if (status === 404 || status === 408 || status === 429 || status === 500 || status === 503 || status === 504) {
    return true;
  }
  return /high demand|try again later|overloaded|unavailable|resource exhausted|currently experiencing/i.test(message);
}

/** What to do after one model rejects a scan. Auth stops; thinking and schema errors retry this model first. */
export function nextGeminiAttempt(
  status: number,
  message: string,
  attempt: GeminiAttempt,
): "auth" | "billing" | "stop" | "next-model" | GeminiAttempt {
  if (status === 401 || status === 403 || isGeminiAuthError(message)) return "auth";
  if (status === 402 || /payment required|credit balance|billing account/i.test(message)) return "billing";
  if (attempt.thinking && /thinking level/i.test(message)) return { ...attempt, thinking: false };
  if (attempt.structured && isGeminiShapeError(message)) return { thinking: false, structured: false };
  if (shouldTryNextModel(status, message)) return "next-model";
  return "stop";
}

function unwrapGeminiPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.find(isRecord) ?? payload[0];
  return payload;
}

function findErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = findErrorMessage(item);
      if (nested) return nested;
    }
    return undefined;
  }
  if (!isRecord(payload)) return undefined;

  const direct = textValue(payload.message) ?? textValue(payload.error);
  const error = isRecord(payload.error) ? payload.error : undefined;
  const fromError = error ? textValue(error.message) : undefined;
  const fromDetails = detailMessage(error ?? payload);
  const specific = [fromError, fromDetails, direct].find((item) => item && !isGenericMessage(item));
  if (specific) return specific;
  if (fromError) return fromError;
  if (direct) return direct;
  if (fromDetails) return fromDetails;
  if (error && typeof error.status === "string" && error.status.trim()) return error.status.trim();
  if (typeof error?.code === "string" && error.code.trim() && Number.isNaN(Number(error.code))) return error.code.trim();
  return undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value.map(textValue).filter((item): item is string => Boolean(item));
    if (parts.length > 0) return parts.join(" ");
  }
  return undefined;
}

function detailMessage(record: Record<string, unknown>): string | undefined {
  const details = Array.isArray(record.details) ? record.details : Array.isArray(record.errors) ? record.errors : [];
  for (const detail of details) {
    const message = isRecord(detail) ? textValue(detail.message) ?? textValue(detail.reason) : textValue(detail);
    if (message) return message;
  }
  return undefined;
}

function isGenericMessage(message: string): boolean {
  return /^(bad request|invalid argument|request contains an invalid argument|invalid_argument)\.?$/i.test(message.trim());
}

function payloadSnippet(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed ? trimmed.slice(0, 240) : undefined;
  }
  try {
    const json = JSON.stringify(payload);
    return json && json !== "{}" && json !== "[]" ? json.slice(0, 240) : undefined;
  } catch {
    return undefined;
  }
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

export function thinkingLevelFor(model: string): "minimal" | "low" | undefined {
  if (/^gemini-3\.[87]/.test(model)) return "low";
  if (model.startsWith("gemini-3")) return "minimal";
  return undefined;
}

function generationThinking(model: string): { thinking_level: "minimal" | "low" } | Record<string, never> {
  const level = thinkingLevelFor(model);
  return level ? { thinking_level: level } : {};
}

export function buildGeminiRequest(
  imageBase64: string,
  mimeType: string,
  model = DEFAULT_GEMINI_MODEL,
  options?: { thinking?: boolean; structured?: boolean },
) {
  const thinking = options?.thinking !== false;
  const structured = options?.structured !== false;
  return {
    model,
    store: false,
    input: [
      { type: "text", text: PROMPT },
      { type: "image", data: imageBase64, mime_type: mimeType },
    ],
    ...(structured
      ? {
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: RESPONSE_SCHEMA,
          },
        }
      : {}),
    generation_config: {
      max_output_tokens: 3072,
      ...(thinking ? generationThinking(model) : {}),
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
