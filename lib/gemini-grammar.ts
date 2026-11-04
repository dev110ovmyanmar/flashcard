import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  JLPT_GRAMMAR_SYSTEM_PROMPT,
  type GrammarAnalyzePayload,
  type GrammarOptionRow,
  type GrammarQuestion,
} from "@/src/constants/grammarPrompt";
import { stripForeignGlosses } from "@/lib/clean-burmese";
import {
  parseIncorrectReasonItems,
  splitGrammarQuestionText,
} from "@/lib/grammar-format";
import {
  cleanImageBase64,
  extractFinishReason,
  isGeminiAuthError,
  isGeminiBillingError,
  isNetworkOrTimeoutError,
  isStructuredOutputError,
  isTruncationFinishReason,
  normalizeImageMimeType,
  shouldTryNextJlptModel,
} from "@/lib/gemini-jlpt";

/** Primary model for grammar / ★ vision analysis (aligned with JLPT; 2.5-flash is retired). */
export const GRAMMAR_DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Fallbacks when the preferred model is missing, busy, or unavailable. */
export const GRAMMAR_GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
] as const;

/** Full grammar pages (10+ rich questions) need more wall-clock than a short crop. */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Match JLPT headroom. Rich options_table × ~10 questions easily exceeds 16k
 * and used to truncate mid-page (often only 1–2 questions returned).
 */
export const GRAMMAR_MAX_OUTPUT_TOKENS = 65_536;

/** Max continuation passes when the first response hits MAX_TOKENS. */
const GRAMMAR_MAX_CONTINUATION_PASSES = 3;

/** Cap for pasted grammar / ★ question text (characters). */
export const GRAMMAR_MAX_TEXT_CHARS = 28_000;

/** Normalize pasted grammar question text for analysis. */
export function normalizeGrammarTextInput(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim().slice(0, GRAMMAR_MAX_TEXT_CHARS);
}

/** Structured JSON schema for grammar question explanations (Vocabulary Analyzer–style). */
export const GRAMMAR_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionNumber: { type: Type.STRING, description: "Question number or star label" },
          questionText: {
            type: Type.STRING,
            description:
              "Full Japanese question text; kanji should use 漢字《ひらがな》 markup for furigana hover",
          },
          correctAnswer: { type: Type.STRING, description: "Correct option number or label" },
          grammarPattern: {
            type: Type.STRING,
            description: "Target grammar with reading, e.g. ～ことだ《ことだ》",
          },
          grammar_meaning_burmese: {
            type: Type.STRING,
            description:
              "Header Line 2: ONLY the absolute core shortest N2 study-note Burmese translation (1–4 words / short A / B). Direct AI generation — never a full explanation. e.g. သင့်သည် / လိုက်ပါ for ことだ; လက်စ for げ",
          },
          options_table: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                option: { type: Type.STRING, description: "Option number or label, e.g. 1" },
                japanese: {
                  type: Type.STRING,
                  description: "Japanese grammar pattern / option surface; 語《よみ》 when useful",
                },
                reading: { type: Type.STRING, description: "Hiragana reading; empty if N/A" },
                meaning_burmese: {
                  type: Type.STRING,
                  description:
                    "N2 study-note core Burmese gloss only (1–4 words / short slash-alternates). Direct AI generation. No usage or long explanation",
                },
                usage_burmese: {
                  type: Type.STRING,
                  description:
                    "ဘယ်နေရာမှာသုံးသလဲ — when/where/how (tone, speaker intent, situation) in Burmese",
                },
                example_sentence: {
                  type: Type.STRING,
                  description:
                    "One Japanese example sentence showing this structure; 漢字《ひらがな》",
                },
                example_burmese: {
                  type: Type.STRING,
                  description: "Natural Burmese translation of example_sentence",
                },
              },
              required: [
                "option",
                "japanese",
                "reading",
                "meaning_burmese",
                "usage_burmese",
                "example_sentence",
                "example_burmese",
              ],
            },
          },
          explanation_burmese: {
            type: Type.STRING,
            description:
              "Clear natural Burmese: why the correct answer (正解) fits the blank. Japanese keywords as 語《よみ》",
          },
          related_grammar_burmese: {
            type: Type.STRING,
            description:
              "EXTERNAL confusing/related grammar only (ရောတတ်သည့် Grammar). Compare the target with 1–2 outside patterns that share similar Burmese meaning. MUST NOT restate or evaluate any of the 4 test options. Empty string if no good external lookalike.",
          },
        },
        required: [
          "questionNumber",
          "questionText",
          "correctAnswer",
          "grammarPattern",
          "grammar_meaning_burmese",
          "options_table",
          "explanation_burmese",
          "related_grammar_burmese",
        ],
      },
    },
  },
  required: ["questions"],
};

/** Soft cap for header Line-2 grammar gloss (code points). Allows short "A / B". */
const GRAMMAR_MEANING_MAX = 32;
const GRAMMAR_SENTENCE_GLOSS_RE =
  /သည်။|ပါသည်။|၏။|ပါ။|မည်။|ခဲ့သည်|နေသည်|ဖြစ်သည်|သောကြောင့်|သဖြင့်|အခါသုံး|ဟုဆို/;

/**
 * Drop meta labels the model prefixes onto related_grammar_burmese
 * (e.g. 「ပြင်ပရောတတ်သည့်ပုံစံ:」). Keep the comparison body only.
 */
export function stripRelatedGrammarMetaPrefix(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(
      /^(?:ပြင်ပ)?ရောတတ်သည့်(?:ပုံစံ|ပုံစ|grammar|Grammar)?\s*[:：\-–—]?\s*/u,
      "",
    )
    .replace(/^(?:外部(?:の)?混同|関連文法|Related(?:\s*\/\s*confusing)?(?:\s*grammar)?)\s*[:：\-–—]?\s*/iu, "")
    .trim();
}

/**
 * Clamp header / option core meanings to a short punchy gloss.
 * Preserves slash-alternates like「သင့်သည် / လိုက်ပါ」(unlike vocab primaryMeaning).
 */
export function shortGrammarMeaning(raw: string | null | undefined): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

  text = text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+《[^》]*》/g, "");
  text = text.replace(/[《》]/g, "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Peel clause dumps before keeping a short core.
  if (GRAMMAR_SENTENCE_GLOSS_RE.test(text) || Array.from(text).length > GRAMMAR_MEANING_MAX) {
    const peeled =
      text
        .split(/(?:သောကြောင့်|သဖြင့်|သည်။|ပါသည်။|၏။|ဖြစ်သည်|ခဲ့သည်|နေသည်|။)/)[0]
        ?.replace(/[။.\s]+$/g, "")
        .trim() ?? "";
    text = peeled || text;
  }

  text = Array.from(text).slice(0, GRAMMAR_MEANING_MAX).join("").trim();
  return text.replace(/[။.]+$/g, "").trim();
}

export type GrammarGeminiCallResult =
  | {
      ok: true;
      payload: unknown;
      rawText: string;
      model: string;
      questions: GrammarQuestion[];
      finishReason?: string;
      truncated: boolean;
    }
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
  imageBase64?: string;
  mimeType?: string;
  textInput?: string;
  structured?: boolean;
  /** Skip these question numbers (continuation after truncation). */
  excludeQuestionNumbers?: readonly string[];
}): Promise<GrammarGeminiCallResult> {
  const { apiKey, model, structured = true, excludeQuestionNumbers = [] } = options;
  const textInput = options.textInput ? normalizeGrammarTextInput(options.textInput) : "";
  const imageBase64 = options.imageBase64 ? cleanImageBase64(options.imageBase64) : "";
  const normalizedMime = normalizeImageMimeType(options.mimeType || "image/jpeg");

  if (!textInput && !imageBase64) {
    return { ok: false, error: "Paste text or choose a photo first.", model, kind: "parse" };
  }

  console.info(
    "[Gemini Grammar] request",
    JSON.stringify({
      model,
      structured,
      mimeType: imageBase64 ? normalizedMime : undefined,
      base64Chars: imageBase64.length || undefined,
      textChars: textInput.length || undefined,
      excludeCount: excludeQuestionNumbers.length || undefined,
      maxOutputTokens: GRAMMAR_MAX_OUTPUT_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      apiKeyPresent: Boolean(apiKey),
    }),
  );

  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: JLPT_GRAMMAR_SYSTEM_PROMPT },
  ];

  if (excludeQuestionNumbers.length > 0) {
    parts.push({
      text: grammarContinuationInstruction(excludeQuestionNumbers),
    });
  }

  if (textInput) {
    parts.push({
      text: `次のテキストはJLPT文法問題（★星印問題を含む）です。画像ではなくテキストとして読み取り、指定のJSONに構造化してください。読める設問はすべて抽出してください。\n\n---\n${textInput}\n---`,
    });
  } else {
    parts.push({
      inlineData: {
        mimeType: normalizedMime,
        data: imageBase64,
      },
    });
    parts.push({
      text: "上の試験用紙画像から、読める文法設問（★を含む）をすべて抽出し、指定のJSONに構造化してください。途中で止めず、欠けなく返してください。",
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
        temperature: 0.2,
        maxOutputTokens: GRAMMAR_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        ...(structured ? { responseSchema: GRAMMAR_RESPONSE_SCHEMA } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const rawText = typeof response.text === "string" ? response.text : "";
    const finishReason = extractFinishReason(response);
    const truncatedByModel = isTruncationFinishReason(finishReason);
    const parsed = questionsFromGrammarGemini(rawText || response);

    if (parsed.error && parsed.questions.length === 0) {
      console.error("[Gemini Grammar] parse failed", {
        model,
        message: parsed.error,
        finishReason,
        rawSnippet: parsed.rawText.slice(0, 500) || rawText.slice(0, 500),
      });
      return { ok: false, error: parsed.error, model, kind: "parse" };
    }

    const truncated = truncatedByModel || Boolean(parsed.partial);
    if (truncated) {
      console.warn("[Gemini Grammar] truncated or partial response", {
        model,
        finishReason,
        questionCount: parsed.questions.length,
        partial: parsed.partial,
      });
    }

    return {
      ok: true,
      payload: { questions: parsed.questions },
      rawText: parsed.rawText || rawText,
      model,
      questions: parsed.questions,
      finishReason,
      truncated,
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

/**
 * Full-page analysis with automatic continuation when the first response is
 * truncated (MAX_TOKENS) or only partially parseable — same idea as JLPT batches.
 */
export async function analyzeGrammarExamPaper(options: {
  apiKey: string;
  model: string;
  imageBase64?: string;
  mimeType?: string;
  textInput?: string;
}): Promise<GrammarGeminiCallResult> {
  const { apiKey, model, imageBase64 = "", mimeType = "image/jpeg", textInput } = options;

  const first = await callGrammarGenerateContent({
    apiKey,
    model,
    imageBase64,
    mimeType,
    textInput,
    structured: true,
  });

  if (!first.ok) {
    if (first.kind === "parse" || isStructuredOutputError(first.error)) {
      const loose = await callGrammarGenerateContent({
        apiKey,
        model,
        imageBase64,
        mimeType,
        textInput,
        structured: false,
      });
      if (!loose.ok) return first;
      return completeGrammarIfNeeded({ apiKey, model, imageBase64, mimeType, textInput, seed: loose });
    }
    return first;
  }

  return completeGrammarIfNeeded({ apiKey, model, imageBase64, mimeType, textInput, seed: first });
}

async function completeGrammarIfNeeded(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  textInput?: string;
  seed: Extract<GrammarGeminiCallResult, { ok: true }>;
}): Promise<GrammarGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType, textInput, seed } = options;

  if (!seed.truncated && seed.questions.length > 0) {
    return seed;
  }

  console.info("[Gemini Grammar] continuing for remaining questions", {
    model,
    seedCount: seed.questions.length,
    truncated: seed.truncated,
    finishReason: seed.finishReason,
    viaText: Boolean(textInput?.trim()),
  });

  let merged = seed.questions;
  const rawParts = [seed.rawText];
  let anyOk = seed.questions.length > 0;
  let lastError = "";

  for (let pass = 0; pass < GRAMMAR_MAX_CONTINUATION_PASSES; pass += 1) {
    const exclude = merged.map((q) => q.questionNumber).filter(Boolean);
    let batchResult = await callGrammarGenerateContent({
      apiKey,
      model,
      imageBase64,
      mimeType,
      textInput,
      structured: true,
      excludeQuestionNumbers: exclude,
    });

    if (!batchResult.ok && (batchResult.kind === "parse" || isStructuredOutputError(batchResult.error))) {
      batchResult = await callGrammarGenerateContent({
        apiKey,
        model,
        imageBase64,
        mimeType,
        textInput,
        structured: false,
        excludeQuestionNumbers: exclude,
      });
    }

    if (!batchResult.ok) {
      lastError = batchResult.error;
      console.error("[Gemini Grammar] continuation failed", { pass, message: batchResult.error });
      break;
    }

    anyOk = true;
    const before = merged.length;
    merged = mergeGrammarQuestions(merged, batchResult.questions);
    rawParts.push(batchResult.rawText);

    if (merged.length === before || !batchResult.truncated) {
      break;
    }
  }

  if (!anyOk) {
    return {
      ok: false,
      error: lastError || seed.rawText || "Gemini returned an incomplete analysis.",
      model,
      kind: "parse",
    };
  }

  return {
    ok: true,
    payload: { questions: merged },
    rawText: rawParts.filter(Boolean).join("\n\n"),
    model,
    questions: merged,
    finishReason: seed.finishReason,
    truncated: false,
  };
}

export function mergeGrammarQuestions(
  existing: GrammarQuestion[],
  incoming: GrammarQuestion[],
): GrammarQuestion[] {
  const byKey = new Map<string, GrammarQuestion>();
  for (const question of [...existing, ...incoming]) {
    const key = grammarQuestionKey(question);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, question);
      continue;
    }
    // Prefer the richer row when duplicates appear across continuation passes.
    byKey.set(key, richerGrammarQuestion(prev, question));
  }
  return [...byKey.values()].sort(compareGrammarQuestions);
}

function grammarQuestionKey(question: GrammarQuestion): string {
  const number = question.questionNumber.trim();
  if (number) return `n:${number}`;
  const pattern = question.grammarPattern.trim();
  if (pattern) return `p:${pattern}`;
  return `t:${question.questionText.trim().slice(0, 80)}`;
}

function richerGrammarQuestion(a: GrammarQuestion, b: GrammarQuestion): GrammarQuestion {
  const score = (q: GrammarQuestion) =>
    q.options_table.length * 10 +
    (q.explanation_burmese ? 3 : 0) +
    (q.related_grammar_burmese ? 2 : 0) +
    (q.grammar_meaning_burmese ? 1 : 0) +
    (q.questionText ? 1 : 0);
  return score(b) > score(a) ? b : a;
}

function compareGrammarQuestions(a: GrammarQuestion, b: GrammarQuestion): number {
  const na = Number.parseInt(a.questionNumber.replace(/[^\d]/g, ""), 10);
  const nb = Number.parseInt(b.questionNumber.replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.questionNumber.localeCompare(b.questionNumber, "ja");
}

function grammarContinuationInstruction(excludeQuestionNumbers: readonly string[]): string {
  const list = excludeQuestionNumbers.map((n) => n.trim()).filter(Boolean).join(", ");
  return [
    "【継続抽出】直前の応答が出力上限で途中終了しました。",
    list ? `次の設問番号は既に抽出済みです: ${list}` : "既に抽出済みの設問があります。",
    "上記以外で、画像／テキストにまだ残っている文法設問（★を含む）をすべて抽出してください。",
    "既に抽出済みの設問を再出力しないでください。読めない設問は作らないでください。",
  ].join("\n");
}

export function questionsFromGrammarGemini(payload: unknown): {
  questions: GrammarQuestion[];
  rawText: string;
  error?: string;
  partial?: boolean;
} {
  if (typeof payload === "string") {
    const parsed = parseModelJson(payload);
    if (!parsed) {
      return { questions: [], rawText: payload, error: "Gemini returned JSON that could not be parsed." };
    }
    return { questions: parsed.questions, rawText: payload, partial: parsed.partial };
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

  return { questions: parsed.questions, rawText: text, partial: parsed.partial };
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

function parseModelJson(text: string): (GrammarAnalyzePayload & { partial?: boolean }) | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const slice = candidate.slice(start);
  try {
    const normalized = normalizeGrammarValue(JSON.parse(slice) as unknown);
    return normalized ? { ...normalized, partial: false } : null;
  } catch {
    return recoverPartialGrammarQuestions(slice);
  }
}

/** Salvage complete question objects from truncated Gemini JSON. */
export function recoverPartialGrammarQuestions(
  text: string,
): (GrammarAnalyzePayload & { partial: true }) | null {
  const questionsIdx = text.search(/"questions"\s*:\s*\[/);
  let cursor = -1;
  if (questionsIdx >= 0) {
    cursor = text.indexOf("[", questionsIdx);
  } else {
    const rootArray = text.trimStart().startsWith("[") ? 0 : text.search(/\[[\s\S]*"questionNumber"/);
    cursor = rootArray;
  }
  if (cursor < 0) return null;

  const questions: GrammarQuestion[] = [];
  let i = cursor + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i += 1;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;
    const extracted = extractBalancedJsonObject(text, i);
    if (!extracted) break;
    try {
      const question = tidyQuestion(JSON.parse(extracted.json) as unknown);
      if (question) questions.push(question);
    } catch {
      /* skip malformed object */
    }
    i = extracted.end;
  }

  if (questions.length === 0) return null;
  return { questions, partial: true };
}

function extractBalancedJsonObject(text: string, start: number): { json: string; end: number } | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { json: text.slice(start, i + 1), end: i + 1 };
      }
    }
  }
  return null;
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
  const explanation_burmese = stripForeignGlosses(
    asString(
      value.explanation_burmese ??
        value.explanationBurmese ??
        value.correctReasonBurmese ??
        value.correct_reason_burmese ??
        value.explanation,
    ),
  );
  const related_grammar_burmese = stripRelatedGrammarMetaPrefix(
    stripForeignGlosses(
      asString(
        value.related_grammar_burmese ??
          value.relatedGrammarBurmese ??
          value.confusing_grammar_burmese ??
          value.confusing_grammar ??
          value.confusingGrammar ??
          value.nuance_note ??
          value.nuanceNote ??
          value.related_grammar,
      ),
    ),
  );
  const legacyIncorrect = stripForeignGlosses(
    asString(value.incorrectReasonsBurmese ?? value.incorrect_reasons_burmese ?? value.wrong_reasons),
  );

  let options_table = tidyOptions(value.options_table ?? value.optionsTable ?? value.options);

  // Legacy flat distractor blob → structured rows (plus stem options when present).
  if (options_table.length === 0 && (legacyIncorrect || questionText)) {
    options_table = synthesizeOptionsFromLegacy({
      questionText,
      correctAnswer,
      incorrectReasonsBurmese: legacyIncorrect,
    });
  }

  const correctRow = options_table.find(
    (row) => row.option.trim() !== "" && row.option.trim() === correctAnswer.trim(),
  );

  // Direct AI generation only — strip Thai/Korean/etc., then clamp; fall back to correct option.
  const grammar_meaning_burmese =
    shortGrammarMeaning(
      stripForeignGlosses(
        asString(
          value.grammar_meaning_burmese ??
            value.grammarMeaningBurmese ??
            value.meaning_burmese ??
            value.meaningBurmese,
        ),
      ),
    ) || shortGrammarMeaning(correctRow?.meaning_burmese);

  if (!questionNumber && !questionText && !grammarPattern && options_table.length === 0) return null;

  return {
    questionNumber,
    questionText,
    correctAnswer,
    grammarPattern,
    grammar_meaning_burmese,
    options_table,
    explanation_burmese,
    related_grammar_burmese,
  };
}

function tidyOptions(value: unknown): GrammarOptionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: GrammarOptionRow[] = [];
  for (const item of value) {
    const row = tidyOptionRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

function tidyOptionRow(value: unknown): GrammarOptionRow | null {
  if (!isRecord(value)) return null;
  const option = asString(value.option ?? value.label ?? value.number);
  const japanese = asString(value.japanese ?? value.pattern ?? value.text ?? value.surface);
  const reading = asString(value.reading ?? value.yomi ?? value.hiragana);
  const meaning_burmese = shortGrammarMeaning(
    stripForeignGlosses(
      asString(value.meaning_burmese ?? value.meaningBurmese ?? value.meaning ?? value.gloss),
    ),
  );
  const usage_burmese = stripForeignGlosses(
    asString(value.usage_burmese ?? value.usageBurmese ?? value.usage ?? value.context_burmese),
  );
  const example_sentence = asString(
    value.example_sentence ??
      value.exampleSentence ??
      value.example ??
      value.context_example ??
      value.contextExample,
  );
  const example_burmese = stripForeignGlosses(
    asString(value.example_burmese ?? value.exampleBurmese ?? value.example_translation_burmese),
  );

  if (!option && !japanese && !meaning_burmese) return null;

  return {
    option,
    japanese,
    reading,
    meaning_burmese,
    usage_burmese,
    example_sentence,
    example_burmese,
  };
}

/** Build options_table from older correctReason / incorrectReasons payloads. */
function synthesizeOptionsFromLegacy(input: {
  questionText: string;
  correctAnswer: string;
  incorrectReasonsBurmese: string;
}): GrammarOptionRow[] {
  const parts = splitGrammarQuestionText(input.questionText);
  const distractors = parseIncorrectReasonItems(input.incorrectReasonsBurmese);
  const byOption = new Map(distractors.map((item) => [item.option.trim(), item]));

  if (parts.options.length >= 2) {
    return parts.options.map((opt) => {
      const distractor = byOption.get(opt.label.trim());
      return {
        option: opt.label,
        japanese: opt.text,
        reading: "",
        meaning_burmese: "",
        usage_burmese: "",
        example_sentence: distractor?.example ?? "",
        example_burmese: "",
      };
    });
  }

  return distractors.map((item) => ({
    option: item.option,
    japanese: item.pattern,
    reading: "",
    meaning_burmese: "",
    usage_burmese: "",
    example_sentence: item.example,
    example_burmese: "",
  }));
}

function classifyGrammarError(
  message: string,
  error: unknown,
): "auth" | "billing" | "timeout" | "network" | "http" | "parse" {
  if (isGeminiAuthError(message)) return "auth";
  if (isGeminiBillingError(message)) return "billing";
  const name = error instanceof Error ? error.name : "";
  const combined = `${name} ${message}`;
  // SDK AbortError / "This operation was aborted" often bypasses network regex — treat as timeout.
  if (/timeout|timed out|abort/i.test(combined) || name === "AbortError") {
    return "timeout";
  }
  if (isNetworkOrTimeoutError(message)) return "network";
  if (isStructuredOutputError(message)) return "parse";
  return "http";
}

function grammarSdkErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    const raw = error.trim();
    if (/abort/i.test(raw)) {
      return `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try a clearer crop or fewer questions, then retry.`;
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
    return `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try a clearer crop or fewer questions, then retry.`;
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
