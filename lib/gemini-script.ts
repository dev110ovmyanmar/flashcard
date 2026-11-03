import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  SCRIPT_ANALYZE_SYSTEM_PROMPT,
  type JlptLevel,
  type ScriptAnalyzePayload,
  type ScriptGrammarItem,
  type ScriptVocabItem,
} from "@/src/constants/scriptPrompt";
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

/** Primary model for script text analysis — Flash-Lite for lowest latency. */
export const SCRIPT_DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export const SCRIPT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
] as const;

const REQUEST_TIMEOUT_MS = 60_000;
const SCRIPT_MAX_OUTPUT_TOKENS = 8_192;
const MAX_SCRIPT_CHARS = 28_000;

export const SCRIPT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          reading: { type: Type.STRING },
          meaning_burmese: { type: Type.STRING },
          explanation_burmese: { type: Type.STRING },
          example_sentence: { type: Type.STRING },
          jlpt_level: { type: Type.STRING },
        },
        required: [
          "word",
          "reading",
          "meaning_burmese",
          "explanation_burmese",
          "example_sentence",
          "jlpt_level",
        ],
      },
    },
    grammar: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pattern: { type: Type.STRING },
          reading: { type: Type.STRING },
          explanation_burmese: { type: Type.STRING },
          usage_in_script: { type: Type.STRING },
          usage_burmese: { type: Type.STRING },
          nuance_burmese: { type: Type.STRING },
          context_example: { type: Type.STRING },
          jlpt_level: { type: Type.STRING },
        },
        required: [
          "pattern",
          "reading",
          "explanation_burmese",
          "usage_in_script",
          "usage_burmese",
          "nuance_burmese",
          "context_example",
          "jlpt_level",
        ],
      },
    },
    page_kind: { type: Type.STRING },
  },
  required: ["vocabulary", "grammar", "page_kind"],
};

export type ScriptGeminiCallResult =
  | { ok: true; payload: ScriptAnalyzePayload; rawText: string; model: string }
  | {
      ok: false;
      error: string;
      model: string;
      kind: "auth" | "billing" | "timeout" | "network" | "http" | "parse";
    };

export function scriptGeminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return SCRIPT_DEFAULT_GEMINI_MODEL;
}

export function scriptGeminiModelChain(preferred: string | undefined): string[] {
  const primary = scriptGeminiModelName(preferred);
  return [primary, ...SCRIPT_GEMINI_FALLBACK_MODELS.filter((model) => model !== primary)];
}

export function normalizeScriptText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim().slice(0, MAX_SCRIPT_CHARS);
}

export async function callScriptGenerateContent(options: {
  apiKey: string;
  model: string;
  scriptText?: string;
  imageBase64?: string;
  mimeType?: string;
  structured?: boolean;
}): Promise<ScriptGeminiCallResult> {
  const { apiKey, model, structured = true } = options;
  const scriptText = options.scriptText ? normalizeScriptText(options.scriptText) : "";
  const imageBase64 = options.imageBase64 ? cleanImageBase64(options.imageBase64) : "";
  const mimeType = options.mimeType ? normalizeImageMimeType(options.mimeType) : "image/jpeg";

  if (!scriptText && !imageBase64) {
    return { ok: false, error: "Paste a script or choose a photo first.", model, kind: "parse" };
  }

  console.info(
    "[Gemini Script] request",
    JSON.stringify({
      model,
      structured,
      scriptChars: scriptText.length,
      hasImage: Boolean(imageBase64),
      mimeType: imageBase64 ? mimeType : undefined,
      base64Chars: imageBase64.length || undefined,
      timeoutMs: REQUEST_TIMEOUT_MS,
      apiKeyPresent: Boolean(apiKey),
    }),
  );

  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: SCRIPT_ANALYZE_SYSTEM_PROMPT },
  ];

  if (imageBase64) {
    parts.push({
      text: "次の画像は日本語の聴解スクリプト／学習テキストです。画像を読み取り、vocabulary と grammar をJSONで返してください。",
    });
    parts.push({
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    });
  }

  if (scriptText) {
    parts.push({
      text: `次の日本語スクリプトを分析し、vocabulary と grammar をJSONで返してください。\n\n---\n${scriptText}\n---`,
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: SCRIPT_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        ...(structured ? { responseSchema: SCRIPT_RESPONSE_SCHEMA } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const rawText = typeof response.text === "string" ? response.text : "";
    const parsed = payloadFromScriptGemini(rawText || response);

    if (parsed.error && parsed.vocabulary.length === 0 && parsed.grammar.length === 0) {
      console.error("[Gemini Script] parse failed", {
        model,
        message: parsed.error,
        rawSnippet: (parsed.rawText || rawText).slice(0, 500),
      });
      return { ok: false, error: parsed.error, model, kind: "parse" };
    }

    const pageKind = extractScriptPageKind(parsed.rawText || rawText, parsed);
    return {
      ok: true,
      payload: {
        vocabulary: parsed.vocabulary,
        grammar: parsed.grammar,
        ...(pageKind ? { page_kind: pageKind } : {}),
      },
      rawText: parsed.rawText || rawText,
      model,
    };
  } catch (error) {
    const message = scriptSdkErrorMessage(error);
    const kind = classifyScriptError(message, error);
    console.error("[Gemini Script] call failed", {
      model,
      kind,
      message: safeMessage(message),
    });
    return { ok: false, error: message, model, kind };
  }
}

export function payloadFromScriptGemini(payload: unknown): {
  vocabulary: ScriptVocabItem[];
  grammar: ScriptGrammarItem[];
  rawText: string;
  error?: string;
} {
  if (typeof payload === "string") {
    const parsed = parseModelJson(payload);
    if (!parsed) {
      return {
        vocabulary: [],
        grammar: [],
        rawText: payload,
        error: "Gemini returned JSON that could not be parsed.",
      };
    }
    return { vocabulary: parsed.vocabulary, grammar: parsed.grammar, rawText: payload };
  }

  if (!isRecord(payload)) {
    return { vocabulary: [], grammar: [], rawText: "", error: "Gemini returned an empty response." };
  }
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return { vocabulary: [], grammar: [], rawText: "", error: payload.error.message };
  }

  const normalizedObject = normalizeScriptValue(payload);
  if (normalizedObject) {
    return {
      vocabulary: normalizedObject.vocabulary,
      grammar: normalizedObject.grammar,
      rawText: safeJson(payload),
    };
  }

  const text = extractText(payload);
  if (!text) {
    return { vocabulary: [], grammar: [], rawText: "", error: "Gemini returned no text for this script." };
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    return {
      vocabulary: [],
      grammar: [],
      rawText: text,
      error: "Gemini returned JSON that could not be parsed.",
    };
  }

  return { vocabulary: parsed.vocabulary, grammar: parsed.grammar, rawText: text };
}

export function shouldTryNextScriptModel(message: string): boolean {
  return shouldTryNextJlptModel(message);
}

export {
  cleanImageBase64,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  normalizeImageMimeType,
};

function parseModelJson(text: string): ScriptAnalyzePayload | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[{[]/);
  if (start < 0) return null;
  try {
    return normalizeScriptValue(JSON.parse(candidate.slice(start)) as unknown);
  } catch {
    return null;
  }
}

function extractScriptPageKind(
  rawText: string,
  parsed: { vocabulary: ScriptVocabItem[]; grammar: ScriptGrammarItem[] },
): ScriptAnalyzePayload["page_kind"] | undefined {
  try {
    const start = rawText.search(/[{[]/);
    if (start >= 0) {
      const root = JSON.parse(rawText.slice(start)) as unknown;
      if (isRecord(root)) {
        const raw = root.page_kind ?? root.pageKind;
        if (typeof raw === "string" && raw.trim()) {
          return raw.trim() as ScriptAnalyzePayload["page_kind"];
        }
      }
    }
  } catch {
    // fall through
  }
  void parsed;
  return undefined;
}

function normalizeScriptValue(value: unknown): ScriptAnalyzePayload | null {
  if (!isRecord(value) && !Array.isArray(value)) return null;

  const vocabList = vocabArray(value);
  const grammarList = grammarArray(value);
  const record = isRecord(value) ? value : null;
  const page_kindRaw = record?.page_kind ?? record?.pageKind;
  const page_kind =
    typeof page_kindRaw === "string"
      ? (page_kindRaw as ScriptAnalyzePayload["page_kind"])
      : undefined;

  if (!vocabList && !grammarList) {
    if (page_kind) return { vocabulary: [], grammar: [], page_kind };
    return null;
  }

  const vocabulary: ScriptVocabItem[] = [];
  for (const item of vocabList ?? []) {
    const row = tidyVocab(item);
    if (row) vocabulary.push(row);
  }

  const grammar: ScriptGrammarItem[] = [];
  for (const item of grammarList ?? []) {
    const row = tidyGrammar(item);
    if (row) grammar.push(row);
  }

  return {
    vocabulary,
    grammar,
    ...(page_kind ? { page_kind } : {}),
  };
}

function vocabArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.vocabulary)) return value.vocabulary;
  if (Array.isArray(value.vocab)) return value.vocab;
  if (Array.isArray(value.goi)) return value.goi;
  if (Array.isArray(value.words)) return value.words;
  return null;
}

function grammarArray(value: unknown): unknown[] | null {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.grammar)) return value.grammar;
  if (Array.isArray(value.bunpou)) return value.bunpou;
  if (Array.isArray(value.patterns)) return value.patterns;
  return null;
}

function tidyVocab(value: unknown): ScriptVocabItem | null {
  if (!isRecord(value)) return null;
  const word = asString(value.word ?? value.kanji ?? value.surface ?? value.headword);
  const reading = asString(value.reading ?? value.kana ?? value.yomi);
  const meaning_burmese = stripForeignGlosses(
    asString(value.meaning_burmese ?? value.meaningBurmese ?? value.burmese ?? value.myanmar),
  );
  // Do not fall back to generic `explanation` — models often fill that in Japanese.
  const explanation_burmese = stripForeignGlosses(
    asString(value.explanation_burmese ?? value.explanationBurmese ?? value.usage_burmese),
  );
  const example_sentence = asString(
    value.example_sentence ?? value.exampleSentence ?? value.example ?? value.sentence,
  );
  const jlpt_level = asJlptLevel(value.jlpt_level ?? value.jlptLevel ?? value.level);

  if (!word && !reading) return null;

  return { word, reading, meaning_burmese, explanation_burmese, example_sentence, jlpt_level };
}

function tidyGrammar(value: unknown): ScriptGrammarItem | null {
  if (!isRecord(value)) return null;
  const pattern = asString(value.pattern ?? value.grammarPattern ?? value.grammar_pattern ?? value.form);
  const reading = asString(value.reading ?? value.yomi);
  // Prefer Burmese keys only — generic `explanation` often comes back Korean/English/Japanese.
  const explanation_burmese = stripForeignGlosses(
    asString(value.explanation_burmese ?? value.explanationBurmese ?? value.meaning_burmese ?? value.burmese),
  );
  const usage_in_script = asString(
    value.usage_in_script ?? value.usageInScript ?? value.example_sentence ?? value.usage ?? value.example,
  );
  const usage_burmese = stripForeignGlosses(
    asString(value.usage_burmese ?? value.usageBurmese ?? value.usage_explanation_burmese),
  );
  const nuance_burmese = stripForeignGlosses(
    asString(value.nuance_burmese ?? value.nuanceBurmese ?? value.nuance_note ?? value.nuance),
  );
  const context_example = asString(
    value.context_example ?? value.contextExample ?? value.extra_example,
  );
  const jlpt_level = asJlptLevel(value.jlpt_level ?? value.jlptLevel ?? value.level);

  if (!pattern && !reading) return null;

  return {
    pattern,
    reading,
    explanation_burmese,
    usage_in_script,
    usage_burmese,
    nuance_burmese,
    context_example,
    jlpt_level,
  };
}

function asJlptLevel(value: unknown): JlptLevel {
  const text = asString(value).toUpperCase();
  if (text === "N1" || text === "N2" || text === "N3" || text === "N4" || text === "N5") return text;
  return "";
}

function classifyScriptError(
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

function scriptSdkErrorMessage(error: unknown): string {
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
