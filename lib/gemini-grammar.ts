import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  JLPT_GRAMMAR_SYSTEM_PROMPT,
  type GrammarAnalyzePayload,
  type GrammarQuestion,
} from "@/src/constants/grammarPrompt";
import {
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  normalizeImageMimeType,
  shouldTryNextJlptModel,
} from "@/lib/gemini-jlpt";

/** Primary model for grammar / ★ vision analysis. */
export const GRAMMAR_DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Fallbacks when the preferred model is missing, busy, or unavailable. */
export const GRAMMAR_GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
] as const;

const REQUEST_TIMEOUT_MS = 45_000;

/** Structured JSON schema for grammar question explanations. */
export const GRAMMAR_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionNumber: { type: Type.STRING, description: "Question number or star label" },
          questionText: { type: Type.STRING, description: "Full Japanese question text" },
          correctAnswer: { type: Type.STRING, description: "Correct option number or label" },
          grammarPattern: { type: Type.STRING, description: "Target grammar pattern" },
          correctReasonBurmese: {
            type: Type.STRING,
            description:
              "Deep sensei-style Burmese: why this grammar fits the speaker's nuance, emotion, and contextual intent",
          },
          incorrectReasonsBurmese: {
            type: Type.STRING,
            description:
              "One wrong option per line as '2 わけだ: …\\n3 ようだ: …' — Burmese why each fails (literal meaning + connection mismatch). Never a single jammed paragraph",
          },
          syntaxBreakdown: {
            type: Type.STRING,
            description:
              "Exact conjugation/connection rule (e.g. Verb dictionary form + ことだ) plus 1–2 contextual Japanese example sentences. No Burmese gloss line",
          },
        },
        required: [
          "questionNumber",
          "questionText",
          "correctAnswer",
          "grammarPattern",
          "correctReasonBurmese",
          "incorrectReasonsBurmese",
          "syntaxBreakdown",
        ],
      },
    },
  },
  required: ["questions"],
};

export type GrammarGeminiCallResult =
  | { ok: true; payload: unknown; rawText: string; model: string }
  | {
      ok: false;
      error: string;
      model: string;
      kind: "auth" | "billing" | "timeout" | "network" | "http" | "parse";
    };

export function grammarGeminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return GRAMMAR_DEFAULT_GEMINI_MODEL;
}

export function grammarGeminiModelChain(preferred: string | undefined): string[] {
  const primary = grammarGeminiModelName(preferred);
  return [primary, ...GRAMMAR_GEMINI_FALLBACK_MODELS.filter((model) => model !== primary)];
}

export { cleanImageBase64, normalizeImageMimeType };

export async function callGrammarGenerateContent(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  structured?: boolean;
}): Promise<GrammarGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType, structured = true } = options;
  const data = cleanImageBase64(imageBase64);
  const normalizedMime = normalizeImageMimeType(mimeType);

  console.info(
    "[Gemini Grammar] request",
    JSON.stringify({
      model,
      structured,
      mimeType: normalizedMime,
      base64Chars: data.length,
      timeoutMs: REQUEST_TIMEOUT_MS,
      apiKeyPresent: Boolean(apiKey),
    }),
  );

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: JLPT_GRAMMAR_SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType: normalizedMime,
                data,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        ...(structured ? { responseSchema: GRAMMAR_RESPONSE_SCHEMA } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const rawText = typeof response.text === "string" ? response.text : "";
    const parsed = questionsFromGrammarGemini(rawText || response);

    if (parsed.error && parsed.questions.length === 0) {
      console.error("[Gemini Grammar] parse failed", {
        model,
        message: parsed.error,
        rawSnippet: parsed.rawText.slice(0, 500) || rawText.slice(0, 500),
      });
      return { ok: false, error: parsed.error, model, kind: "parse" };
    }

    return {
      ok: true,
      payload: { questions: parsed.questions },
      rawText: parsed.rawText || rawText,
      model,
    };
  } catch (error) {
    const message = grammarSdkErrorMessage(error);
    const kind = classifyGrammarError(message, error);
    console.error("[Gemini Grammar] call failed", {
      model,
      kind,
      message: safeMessage(message),
    });
    return { ok: false, error: message, model, kind };
  }
}

export function questionsFromGrammarGemini(payload: unknown): {
  questions: GrammarQuestion[];
  rawText: string;
  error?: string;
} {
  if (typeof payload === "string") {
    const parsed = parseModelJson(payload);
    if (!parsed) {
      return { questions: [], rawText: payload, error: "Gemini returned JSON that could not be parsed." };
    }
    return { questions: parsed.questions, rawText: payload };
  }

  if (!isRecord(payload)) return { questions: [], rawText: "", error: "Gemini returned an empty response." };
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return { questions: [], rawText: "", error: payload.error.message };
  }

  // Already-normalized { questions: [...] }
  if (Array.isArray(payload.questions)) {
    const normalized = normalizeGrammarValue(payload);
    if (normalized) return { questions: normalized.questions, rawText: safeJson(payload) };
  }

  const text = extractText(payload);
  if (!text) {
    return { questions: [], rawText: "", error: "Gemini returned no text for this photo." };
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    return { questions: [], rawText: text, error: "Gemini returned JSON that could not be parsed." };
  }

  return { questions: parsed.questions, rawText: text };
}

export function shouldTryNextGrammarModel(message: string): boolean {
  return shouldTryNextJlptModel(message);
}

export {
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
};

function parseModelJson(text: string): GrammarAnalyzePayload | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  try {
    return normalizeGrammarValue(JSON.parse(candidate.slice(start)) as unknown);
  } catch {
    return null;
  }
}

function normalizeGrammarValue(value: unknown): GrammarAnalyzePayload | null {
  const list = questionList(value);
  if (!list) return null;
  const questions: GrammarQuestion[] = [];
  for (const item of list) {
    const question = tidyQuestion(item);
    if (question) questions.push(question);
  }
  return { questions };
}

function questionList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.questions)) return value.questions;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.items)) return value.items;
  return null;
}

function tidyQuestion(value: unknown): GrammarQuestion | null {
  if (!isRecord(value)) return null;

  const questionNumber = asString(value.questionNumber ?? value.question_number ?? value.number);
  const questionText = asString(value.questionText ?? value.question_text ?? value.sentence ?? value.text);
  const correctAnswer = asString(value.correctAnswer ?? value.correct_answer ?? value.answer);
  const grammarPattern = asString(value.grammarPattern ?? value.grammar_pattern ?? value.pattern);
  const correctReasonBurmese = asString(
    value.correctReasonBurmese ?? value.correct_reason_burmese ?? value.explanation_burmese ?? value.explanation,
  );
  const incorrectReasonsBurmese = asString(
    value.incorrectReasonsBurmese ?? value.incorrect_reasons_burmese ?? value.wrong_reasons,
  );
  const syntaxBreakdown = asString(
    value.syntaxBreakdown ?? value.syntax_breakdown ?? value.structure ?? value.breakdown,
  );

  if (!questionNumber && !questionText && !grammarPattern) return null;

  return {
    questionNumber,
    questionText,
    correctAnswer,
    grammarPattern,
    correctReasonBurmese,
    incorrectReasonsBurmese,
    syntaxBreakdown,
  };
}

function classifyGrammarError(
  message: string,
  error: unknown,
): "auth" | "billing" | "timeout" | "network" | "http" | "parse" {
  if (isGeminiAuthError(message)) return "auth";
  if (isGeminiBillingError(message)) return "billing";
  if (isNetworkOrTimeoutError(message)) {
    const name = error instanceof Error ? error.name : "";
    if (/timeout|abort/i.test(`${name} ${message}`)) return "timeout";
    return "network";
  }
  if (isStructuredOutputError(message)) return "parse";
  return "http";
}

function grammarSdkErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 400);
  if (!isRecord(error)) return "Gemini request failed.";

  const nested = isRecord(error.error) ? error.error : null;
  const message =
    textValue(error.message) ??
    textValue(nested?.message) ??
    (typeof error.status === "number" ? `Gemini returned ${error.status}` : undefined) ??
    "Gemini request failed.";

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
