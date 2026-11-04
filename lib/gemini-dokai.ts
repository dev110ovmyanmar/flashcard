import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  DOKAI_SNAP_SYSTEM_PROMPT,
  type DokaiAnalyzePayload,
  type DokaiGlossaryEntry,
  type DokaiOptionRow,
  type DokaiQuestion,
} from "@/src/constants/dokaiPrompt";
import { stripForeignGlosses } from "@/lib/clean-burmese";
import {
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  normalizeImageMimeType,
  shouldTryNextJlptModel,
} from "@/lib/gemini-jlpt";

export const DOKAI_DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const DOKAI_GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
] as const;

const REQUEST_TIMEOUT_MS = 90_000;
const DOKAI_MAX_OUTPUT_TOKENS = 65_536;
export const DOKAI_MAX_TEXT_CHARS = 28_000;

export const DOKAI_SNAP_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    passage_text: { type: Type.STRING },
    summary_burmese: { type: Type.STRING },
    intent_burmese: { type: Type.STRING },
    glossary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          surface: { type: Type.STRING },
          reading: { type: Type.STRING },
          meaning_burmese: { type: Type.STRING },
        },
        required: ["surface", "reading", "meaning_burmese"],
      },
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question_number: { type: Type.STRING },
          question_text: { type: Type.STRING },
          correct_option: { type: Type.STRING },
          options_table: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                option: { type: Type.STRING },
                japanese: { type: Type.STRING },
                meaning_burmese: { type: Type.STRING },
                why_wrong_burmese: { type: Type.STRING },
              },
              required: ["option", "japanese", "meaning_burmese", "why_wrong_burmese"],
            },
          },
          explanation_burmese: { type: Type.STRING },
        },
        required: [
          "question_number",
          "question_text",
          "correct_option",
          "options_table",
          "explanation_burmese",
        ],
      },
    },
  },
  required: ["passage_text", "summary_burmese", "intent_burmese", "glossary", "questions"],
};

export type DokaiGeminiCallResult =
  | { ok: true; payload: DokaiAnalyzePayload; rawText: string; model: string }
  | {
      ok: false;
      error: string;
      model: string;
      kind: "auth" | "billing" | "timeout" | "network" | "http" | "parse";
    };

export function dokaiGeminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return DOKAI_DEFAULT_GEMINI_MODEL;
}

export function dokaiGeminiModelChain(preferred: string | undefined): string[] {
  const primary = dokaiGeminiModelName(preferred);
  return [primary, ...DOKAI_GEMINI_FALLBACK_MODELS.filter((model) => model !== primary)];
}

export function normalizeDokaiTextInput(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim().slice(0, DOKAI_MAX_TEXT_CHARS);
}

export { cleanImageBase64, normalizeImageMimeType };

export async function callDokaiSnapGenerateContent(options: {
  apiKey: string;
  model: string;
  imageBase64?: string;
  mimeType?: string;
  textInput?: string;
  structured?: boolean;
}): Promise<DokaiGeminiCallResult> {
  const { apiKey, model, structured = true } = options;
  const textInput = options.textInput ? normalizeDokaiTextInput(options.textInput) : "";
  const imageBase64 = options.imageBase64 ? cleanImageBase64(options.imageBase64) : "";
  const normalizedMime = normalizeImageMimeType(options.mimeType || "image/jpeg");

  if (!textInput && !imageBase64) {
    return { ok: false, error: "Paste text or choose a photo first.", model, kind: "parse" };
  }

  console.info(
    "[Gemini Dokai] snap request",
    JSON.stringify({
      model,
      structured,
      mimeType: imageBase64 ? normalizedMime : undefined,
      base64Chars: imageBase64.length || undefined,
      textChars: textInput.length || undefined,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
  );

  const ai = new GoogleGenAI({ apiKey });
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: DOKAI_SNAP_SYSTEM_PROMPT },
  ];

  if (textInput) {
    parts.push({
      text: `次のテキストはJLPT読解（Dokai）です。画像ではなくテキストとして読み取り、設問の正解／誤答を含む指定のJSONに構造化してください。\n\n---\n${textInput}\n---`,
    });
  } else {
    parts.push({
      inlineData: { mimeType: normalizedMime, data: imageBase64 },
    });
    parts.push({
      text: "上の読解ページ画像から本文と設問をOCR抽出し、各設問の正解／誤答解説を含む指定JSONを返してください。設問を1問も漏らさないでください。",
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.2,
        maxOutputTokens: DOKAI_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        ...(structured ? { responseSchema: DOKAI_SNAP_RESPONSE_SCHEMA } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const rawText = typeof response.text === "string" ? response.text : "";
    const parsed = dokaiSnapFromGemini(rawText || response);
    if (
      parsed.error &&
      parsed.payload.questions.length === 0 &&
      !parsed.payload.passage_text &&
      !parsed.payload.summary_burmese
    ) {
      return { ok: false, error: parsed.error, model, kind: "parse" };
    }

    return {
      ok: true,
      payload: parsed.payload,
      rawText: parsed.rawText || rawText,
      model,
    };
  } catch (error) {
    const message = dokaiSdkErrorMessage(error);
    const kind = classifyDokaiError(message, error);
    console.error("[Gemini Dokai] snap failed", { model, kind, message: safeMessage(message) });
    return { ok: false, error: message, model, kind };
  }
}

export function shouldTryNextDokaiModel(message: string): boolean {
  return shouldTryNextJlptModel(message);
}

export {
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
};

export function dokaiSnapFromGemini(payload: unknown): {
  payload: DokaiAnalyzePayload;
  rawText: string;
  error?: string;
} {
  if (typeof payload === "string") {
    const parsed = parseSnapJson(payload);
    if (!parsed) {
      return {
        payload: emptySnap(),
        rawText: payload,
        error: "Gemini returned JSON that could not be parsed.",
      };
    }
    return { payload: parsed, rawText: payload };
  }

  if (!isRecord(payload)) {
    return { payload: emptySnap(), rawText: "", error: "Gemini returned an empty response." };
  }
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return { payload: emptySnap(), rawText: "", error: payload.error.message };
  }

  if (
    Array.isArray(payload.questions) ||
    typeof payload.passage_text === "string" ||
    typeof payload.passageText === "string" ||
    typeof payload.summary_burmese === "string" ||
    typeof payload.summaryBurmese === "string"
  ) {
    const normalized = normalizeSnapValue(payload);
    if (normalized) return { payload: normalized, rawText: safeJson(payload) };
  }

  const text = extractText(payload);
  if (!text) {
    return { payload: emptySnap(), rawText: "", error: "Gemini returned no text for this photo." };
  }
  const parsed = parseSnapJson(text);
  if (!parsed) {
    return { payload: emptySnap(), rawText: text, error: "Gemini returned JSON that could not be parsed." };
  }
  return { payload: parsed, rawText: text };
}

function parseSnapJson(text: string): DokaiAnalyzePayload | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[{[]/);
  if (start < 0) return null;
  try {
    return normalizeSnapValue(JSON.parse(candidate.slice(start)) as unknown);
  } catch {
    return null;
  }
}

function normalizeSnapValue(value: unknown): DokaiAnalyzePayload | null {
  if (!isRecord(value)) return null;
  const passage_text = asString(value.passage_text ?? value.passageText ?? value.text ?? value.passage);
  const summary_burmese = stripForeignGlosses(
    asString(value.summary_burmese ?? value.summaryBurmese ?? value.summary),
  );
  const intent_burmese = stripForeignGlosses(
    asString(value.intent_burmese ?? value.intentBurmese ?? value.intent ?? value.takeaway_burmese),
  );
  const glossary = tidyGlossary(value.glossary ?? value.vocab ?? value.vocabulary ?? value.words);
  const questions = tidyQuestions(value.questions ?? value.question_list ?? value.items);

  if (questions.length === 0 && !passage_text && !summary_burmese && !intent_burmese) return null;
  return { passage_text, summary_burmese, intent_burmese, glossary, questions };
}

function tidyGlossary(value: unknown): DokaiGlossaryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: DokaiGlossaryEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const surface = asString(item.surface ?? item.word ?? item.japanese ?? item.text).replace(
      /《[^》]*》/g,
      "",
    );
    const reading = asString(item.reading ?? item.furigana ?? item.yomi);
    const meaning_burmese = stripForeignGlosses(
      asString(item.meaning_burmese ?? item.meaningBurmese ?? item.burmese ?? item.meaning),
    );
    if (!surface || !meaning_burmese) continue;
    if (seen.has(surface)) continue;
    seen.add(surface);
    rows.push({ surface, reading, meaning_burmese });
    if (rows.length >= 40) break;
  }
  return rows;
}

function tidyQuestions(value: unknown): DokaiQuestion[] {
  if (!Array.isArray(value)) return [];
  const questions: DokaiQuestion[] = [];
  for (const item of value) {
    const question = tidyQuestion(item);
    if (question) questions.push(question);
  }
  questions.sort((a, b) => {
    const an = Number.parseInt(a.question_number, 10);
    const bn = Number.parseInt(b.question_number, 10);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return a.question_number.localeCompare(b.question_number, "ja");
  });
  return questions;
}

function tidyQuestion(value: unknown): DokaiQuestion | null {
  if (!isRecord(value)) return null;
  const question_number = asString(
    value.question_number ?? value.questionNumber ?? value.number ?? value.id,
  );
  const question_text = asString(
    value.question_text ?? value.questionText ?? value.stem ?? value.japanese_sentence ?? value.question,
  );
  const correct_option = asString(
    value.correct_option ?? value.correctOption ?? value.correctAnswer ?? value.answer,
  );
  const explanation_burmese = stripForeignGlosses(
    asString(value.explanation_burmese ?? value.explanationBurmese ?? value.explanation),
  );
  const options_table = tidyOptions(value.options_table ?? value.optionsTable ?? value.options).map(
    (row) => {
      const isCorrect = row.option.trim() !== "" && row.option.trim() === correct_option.trim();
      return {
        ...row,
        why_wrong_burmese: isCorrect ? "" : row.why_wrong_burmese,
      };
    },
  );

  if (!question_text && options_table.length === 0) return null;
  return {
    question_number,
    question_text,
    correct_option,
    options_table,
    explanation_burmese,
  };
}

function tidyOptions(value: unknown): DokaiOptionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: DokaiOptionRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const option = asString(item.option ?? item.number ?? item.label ?? item.id);
    const japanese = asString(item.japanese ?? item.text ?? item.choice ?? item.word);
    const meaning_burmese = stripForeignGlosses(
      asString(item.meaning_burmese ?? item.meaningBurmese ?? item.burmese ?? item.meaning),
    );
    const why_wrong_burmese = stripForeignGlosses(
      asString(
        item.why_wrong_burmese ??
          item.whyWrongBurmese ??
          item.why_wrong ??
          item.whyWrong ??
          item.distractor_reason ??
          item.incorrect_reason,
      ),
    );
    if (!option && !japanese && !meaning_burmese) continue;
    rows.push({ option, japanese, meaning_burmese, why_wrong_burmese });
  }
  return rows;
}

function emptySnap(): DokaiAnalyzePayload {
  return { passage_text: "", summary_burmese: "", intent_burmese: "", glossary: [], questions: [] };
}

function classifyDokaiError(
  message: string,
  error: unknown,
): "auth" | "billing" | "timeout" | "network" | "http" | "parse" {
  if (isGeminiAuthError(message)) return "auth";
  if (isGeminiBillingError(message)) return "billing";
  const name = error instanceof Error ? error.name : "";
  const combined = `${name} ${message}`;
  if (/timeout|timed out|abort/i.test(combined) || name === "AbortError") return "timeout";
  if (isNetworkOrTimeoutError(message)) return "network";
  if (isStructuredOutputError(message)) return "parse";
  return "http";
}

function dokaiSdkErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    const raw = error.trim();
    if (/abort/i.test(raw)) {
      return `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try a clearer crop, then retry.`;
    }
    return raw.slice(0, 400);
  }
  if (!isRecord(error)) return "Gemini request failed.";
  const nested = isRecord(error.error) ? error.error : null;
  const name = typeof error.name === "string" ? error.name : "";
  const message =
    textValue(error.message) ??
    textValue(nested?.message) ??
    (typeof error.status === "number" ? `Gemini returned ${error.status}` : undefined) ??
    "Gemini request failed.";
  if (name === "AbortError" || /abort/i.test(message)) {
    return `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try a clearer crop, then retry.`;
  }
  return message.slice(0, 400);
}

function extractText(payload: Record<string, unknown>): string {
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
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

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function safeMessage(message: string): string {
  return message.replace(/key=[^&\s]+/gi, "key=…").slice(0, 400);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
