import {
  JLPT_MONDAI_BATCHES,
  jlptSystemPrompt,
  type JlptAnalyzePayload,
  type JlptFuriganaToken,
  type JlptMondaiType,
  type JlptOptionRow,
  type JlptQuestion,
} from "@/src/constants/jlptPrompt";

/** Primary model for JLPT vision analysis — Flash-Lite for lowest latency. */
export const JLPT_DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Fallbacks when the preferred model is missing, busy, or unavailable. */
export const JLPT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
] as const;

/** Enough headroom for a full Mondai 1–6 page of short Burmese explanations. */
export const JLPT_MAX_OUTPUT_TOKENS = 65_536;

const REQUEST_TIMEOUT_MS = 90_000;

/** REST responseSchema for generateContent JSON mode. */
const JLPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          mondai_type: { type: "INTEGER" },
          question_number: { type: "INTEGER" },
          japanese_sentence: { type: "STRING" },
          furigana_tokens: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                surface: { type: "STRING" },
                reading: { type: "STRING" },
              },
              required: ["surface", "reading"],
            },
          },
          target_word: { type: "STRING" },
          reading: { type: "STRING" },
          correct_option: { type: "STRING" },
          options_table: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                option: { type: "STRING" },
                japanese: { type: "STRING" },
                reading: { type: "STRING" },
                meaning_burmese: { type: "STRING" },
                usage_burmese: { type: "STRING" },
                why_wrong_burmese: { type: "STRING" },
              },
              required: [
                "option",
                "japanese",
                "reading",
                "meaning_burmese",
                "usage_burmese",
                "why_wrong_burmese",
              ],
            },
          },
          explanation_burmese: { type: "STRING" },
          nuance_note: { type: "STRING" },
        },
        required: [
          "mondai_type",
          "question_number",
          "japanese_sentence",
          "furigana_tokens",
          "target_word",
          "reading",
          "correct_option",
          "options_table",
          "explanation_burmese",
          "nuance_note",
        ],
      },
    },
  },
  required: ["questions"],
} as const;

export type JlptGeminiCallResult =
  | {
      ok: true;
      payload: unknown;
      rawText: string;
      model: string;
      questions: JlptQuestion[];
      finishReason?: string;
      truncated: boolean;
    }
  | { ok: false; error: string; model: string; kind: "auth" | "billing" | "timeout" | "network" | "http" | "parse" };

export function jlptGeminiModelName(value: string | undefined): string {
  const trimmed = value?.trim().replace(/^models\//, "");
  if (trimmed && /^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return trimmed;
  return JLPT_DEFAULT_GEMINI_MODEL;
}

export function jlptGeminiModelChain(preferred: string | undefined): string[] {
  const primary = jlptGeminiModelName(preferred);
  return [primary, ...JLPT_GEMINI_FALLBACK_MODELS.filter((model) => model !== primary)];
}

/** Normalize MIME for Gemini inline image parts. */
export function normalizeImageMimeType(mimeType: string): string {
  const base = mimeType.trim().toLowerCase().split(";")[0]?.trim() || "image/jpeg";
  if (base === "image/jpg") return "image/jpeg";
  if (
    base === "image/jpeg" ||
    base === "image/png" ||
    base === "image/webp" ||
    base === "image/gif" ||
    base === "image/heic" ||
    base === "image/heif"
  ) {
    return base;
  }
  return "image/jpeg";
}

/** Strip data-URL prefix and whitespace from base64 image payloads. */
export function cleanImageBase64(input: string): string {
  const marker = "base64,";
  const index = input.indexOf(marker);
  return (index >= 0 ? input.slice(index + marker.length) : input).replace(/\s/g, "");
}

/**
 * Official generateContent URL:
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...
 */
export function buildGenerateContentUrl(model: string, apiKey: string): string {
  const safeModel = encodeURIComponent(model.replace(/^models\//, ""));
  return `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

/** REST body: prompt text + inline_data image (snake_case MIME fields). */
export function buildJlptGenerateContentBody(
  imageBase64: string,
  mimeType: string,
  options?: { structured?: boolean; mondaiTypes?: readonly JlptMondaiType[] },
) {
  const structured = options?.structured !== false;
  const data = cleanImageBase64(imageBase64);
  const normalizedMime = normalizeImageMimeType(mimeType);
  const prompt = jlptSystemPrompt(options?.mondaiTypes);

  // Only send fields supported by generateContent for Flash models.
  // Do not include thinking / thinkingConfig — it 400s on flash-lite / 3.8-flash.
  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: normalizedMime,
              data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: JLPT_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      ...(structured ? { responseSchema: JLPT_RESPONSE_SCHEMA } : {}),
    },
  };
}

/** @deprecated Prefer buildJlptGenerateContentBody — kept for older tests/call sites. */
export function buildJlptImageParts(imageBase64: string, mimeType: string) {
  const data = cleanImageBase64(imageBase64);
  const normalizedMime = normalizeImageMimeType(mimeType);
  return [
    { text: jlptSystemPrompt() },
    {
      inlineData: {
        mimeType: normalizedMime,
        data,
      },
    },
  ] as const;
}

export async function callJlptGenerateContent(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  structured?: boolean;
  mondaiTypes?: readonly JlptMondaiType[];
}): Promise<JlptGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType, structured = true, mondaiTypes } = options;
  return postJlptGenerateContent({
    apiKey,
    model,
    imageBase64,
    mimeType,
    structured,
    mondaiTypes,
  });
}

/**
 * Full-page analysis with automatic Mondai batch continuation when the first
 * response is truncated (MAX_TOKENS) or only partially parseable.
 */
export async function analyzeJlptExamPaper(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
}): Promise<JlptGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType } = options;

  const first = await callJlptGenerateContent({
    apiKey,
    model,
    imageBase64,
    mimeType,
    structured: true,
  });

  if (!first.ok) {
    if (first.kind === "parse" || isStructuredOutputError(first.error)) {
      const loose = await callJlptGenerateContent({
        apiKey,
        model,
        imageBase64,
        mimeType,
        structured: false,
      });
      if (!loose.ok) return first;
      return completeJlptIfNeeded({ apiKey, model, imageBase64, mimeType, seed: loose });
    }
    return first;
  }

  return completeJlptIfNeeded({ apiKey, model, imageBase64, mimeType, seed: first });
}

async function completeJlptIfNeeded(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  seed: Extract<JlptGeminiCallResult, { ok: true }>;
}): Promise<JlptGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType, seed } = options;

  if (!seed.truncated && seed.questions.length > 0) {
    return seed;
  }

  console.info("[Gemini JLPT] continuing with Mondai batches", {
    model,
    seedCount: seed.questions.length,
    truncated: seed.truncated,
    finishReason: seed.finishReason,
  });

  let merged = seed.questions;
  let rawParts = [seed.rawText];
  let anyOk = seed.questions.length > 0;
  let lastError = "";

  for (const batch of JLPT_MONDAI_BATCHES) {
    let batchResult = await callJlptGenerateContent({
      apiKey,
      model,
      imageBase64,
      mimeType,
      structured: true,
      mondaiTypes: batch,
    });

    if (!batchResult.ok && (batchResult.kind === "parse" || isStructuredOutputError(batchResult.error))) {
      batchResult = await callJlptGenerateContent({
        apiKey,
        model,
        imageBase64,
        mimeType,
        structured: false,
        mondaiTypes: batch,
      });
    }

    if (!batchResult.ok) {
      lastError = batchResult.error;
      console.error("[Gemini JLPT] batch failed", { batch, message: batchResult.error });
      continue;
    }

    anyOk = true;
    merged = mergeJlptQuestions(merged, batchResult.questions);
    rawParts.push(batchResult.rawText);
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
    payload: seed.payload,
    rawText: rawParts.filter(Boolean).join("\n\n"),
    model,
    questions: merged,
    finishReason: seed.finishReason,
    truncated: false,
  };
}

async function postJlptGenerateContent(options: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mimeType: string;
  structured: boolean;
  mondaiTypes?: readonly JlptMondaiType[];
}): Promise<JlptGeminiCallResult> {
  const { apiKey, model, imageBase64, mimeType, structured, mondaiTypes } = options;
  const url = buildGenerateContentUrl(model, apiKey);
  const body = buildJlptGenerateContentBody(imageBase64, mimeType, { structured, mondaiTypes });
  const mime = body.contents[0]?.parts[1]?.inline_data?.mime_type ?? mimeType;
  const base64Chars = body.contents[0]?.parts[1]?.inline_data?.data.length ?? 0;

  console.info(
    "[Gemini JLPT] request",
    JSON.stringify({
      model,
      structured,
      mondaiTypes: mondaiTypes ?? "all",
      mimeType: mime,
      base64Chars,
      maxOutputTokens: JLPT_MAX_OUTPUT_TOKENS,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      generationConfigKeys: Object.keys(body.generationConfig),
      apiKeyPresent: Boolean(apiKey),
      apiKeyLength: apiKey.length,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }),
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const diagnosed = diagnoseFetchFailure(error, apiKey);
    console.error("[Gemini JLPT] fetch failed", {
      model,
      kind: diagnosed.kind,
      message: diagnosed.message,
      cause: causeSummary(error),
    });
    return { ok: false, error: diagnosed.message, model, kind: diagnosed.kind };
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  try {
    payload = rawBody.trim() ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    payload = rawBody;
  }

  if (!response.ok) {
    const message = geminiHttpErrorMessage(payload, response.status, rawBody);
    const kind = classifyHttpError(response.status, message);
    console.error("[Gemini JLPT] HTTP error", {
      model,
      status: response.status,
      statusText: response.statusText,
      kind,
      message,
      bodySnippet: rawBody.slice(0, 800),
    });
    return { ok: false, error: message, model, kind };
  }

  const finishReason = extractFinishReason(payload);
  const truncatedByModel = isTruncationFinishReason(finishReason);
  const parsed = questionsFromGemini(payload);

  if (parsed.error && parsed.questions.length === 0) {
    console.error("[Gemini JLPT] parse failed", {
      model,
      message: parsed.error,
      finishReason,
      rawSnippet: parsed.rawText.slice(0, 500) || rawBody.slice(0, 500),
    });
    return { ok: false, error: parsed.error, model, kind: "parse" };
  }

  const truncated = truncatedByModel || Boolean(parsed.partial);
  if (truncated) {
    console.warn("[Gemini JLPT] truncated or partial response", {
      model,
      finishReason,
      questionCount: parsed.questions.length,
      partial: parsed.partial,
    });
  }

  return {
    ok: true,
    payload,
    rawText: parsed.rawText,
    model,
    questions: parsed.questions,
    finishReason,
    truncated,
  };
}

function diagnoseFetchFailure(
  error: unknown,
  apiKey: string,
): { kind: "auth" | "timeout" | "network"; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  const cause = isRecord(error) && "cause" in error ? error.cause : undefined;
  const causeMessage = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const combined = `${name} ${message} ${causeMessage}`.toLowerCase();

  if (!apiKey.trim()) {
    return {
      kind: "auth",
      message: "No Gemini API key is set. Add GEMINI_API_KEY to .env.local, then restart the dev server.",
    };
  }

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /timeout|aborted|exceeded/i.test(combined)
  ) {
    return {
      kind: "timeout",
      message: `Gemini request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check your network, VPN, or firewall, then try again.`,
    };
  }

  if (/fetch failed|network|enotfound|econnrefused|econnreset|cert|ssl|unable to connect/i.test(combined)) {
    return {
      kind: "network",
      message: `Network error reaching Gemini (fetch failed). Check internet/DNS/VPN. Details: ${safeMessage(message || causeMessage || "fetch failed")}`,
    };
  }

  return {
    kind: "network",
    message: `Gemini request failed before a response. Details: ${safeMessage(message || "fetch failed")}`,
  };
}

function classifyHttpError(status: number, message: string): "auth" | "billing" | "http" {
  if (status === 401 || status === 403 || isGeminiAuthError(message)) return "auth";
  if (status === 402 || isGeminiBillingError(message)) return "billing";
  return "http";
}

function geminiHttpErrorMessage(payload: unknown, status: number, rawBody: string): string {
  if (isRecord(payload)) {
    const nested = isRecord(payload.error) ? payload.error : null;
    const fromNested = nested ? textValue(nested.message) : undefined;
    const fromTop = textValue(payload.message);
    if (fromNested) return fromNested;
    if (fromTop) return fromTop;
    const statusLabel = nested && typeof nested.status === "string" ? nested.status : undefined;
    if (statusLabel) return statusLabel;
  }
  if (typeof payload === "string" && payload.trim()) return payload.trim().slice(0, 400);
  if (rawBody.trim()) return rawBody.trim().slice(0, 400);
  return `Gemini returned HTTP ${status}.`;
}

function causeSummary(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.name, error.message];
  if ("cause" in error && error.cause != null) {
    parts.push(error.cause instanceof Error ? `${error.cause.name}: ${error.cause.message}` : String(error.cause));
  }
  return parts.filter(Boolean).join(" | ").slice(0, 500);
}

function safeMessage(message: string): string {
  return message.replace(/key=[^&\s]+/gi, "key=…").slice(0, 400);
}

/**
 * Extract the most useful message from a GoogleGenerativeAI / fetch failure.
 * Logs the full error object (and nested API body when present).
 */
export function googleGenerativeAiErrorMessage(error: unknown): string {
  console.error("[Gemini JLPT] raw error:", error);

  if (typeof error === "string" && error.trim()) {
    console.error("[Gemini JLPT] message:", error.trim());
    return error.trim();
  }

  if (!isRecord(error)) {
    const fallback = "Gemini request failed.";
    console.error("[Gemini JLPT] message:", fallback);
    return fallback;
  }

  const nested = isRecord(error.error) ? error.error : null;
  const details = Array.isArray(error.errorDetails)
    ? error.errorDetails
    : Array.isArray(nested?.details)
      ? nested.details
      : [];

  const detailMessages: string[] = [];
  for (const detail of details) {
    if (typeof detail === "string" && detail.trim()) {
      detailMessages.push(detail.trim());
      continue;
    }
    if (!isRecord(detail)) continue;
    const piece =
      textValue(detail.message) ??
      textValue(detail.reason) ??
      textValue(detail["@type"]) ??
      (typeof detail === "object" ? safeJson(detail) : undefined);
    if (piece) detailMessages.push(piece);
  }

  const status =
    typeof error.status === "number"
      ? error.status
      : typeof nested?.code === "number"
        ? nested.code
        : undefined;
  const statusText = textValue(error.statusText);

  const message =
    textValue(error.message) ??
    textValue(nested?.message) ??
    detailMessages[0] ??
    (status != null ? `Gemini returned ${status}${statusText ? ` ${statusText}` : ""}` : undefined) ??
    "Gemini request failed.";

  console.error("[Gemini JLPT] message:", message);
  if (status != null) console.error("[Gemini JLPT] status:", status, statusText ?? "");
  if (detailMessages.length) console.error("[Gemini JLPT] details:", detailMessages.join(" | "));
  if (nested) console.error("[Gemini JLPT] error body:", safeJson(nested));

  return message;
}

export function isGeminiAuthError(message: string): boolean {
  return /api key not valid|api_key_invalid|permission denied|unregistered callers|consumer identity|authentication|invalid api key|api key not set/i.test(
    message,
  );
}

export function isGeminiBillingError(message: string): boolean {
  return /payment required|credit balance|billing account|quota.*bill/i.test(message);
}

export function isNetworkOrTimeoutError(message: string): boolean {
  return /fetch failed|timed out|timeout|network error|enotfound|econnrefused|econnreset|dns|vpn|firewall/i.test(
    message,
  );
}

export function shouldTryNextJlptModel(message: string): boolean {
  if (isGeminiAuthError(message) || isGeminiBillingError(message)) return false;
  if (isNetworkOrTimeoutError(message)) return true;
  return /not found|not supported|unknown model|does not exist|no longer available|not available|high demand|try again later|overloaded|unavailable|resource exhausted|currently experiencing|429|500|503|504/i.test(
    message,
  );
}

export function isStructuredOutputError(message: string): boolean {
  return /response.?schema|response.?mime|json schema|invalid schema|unknown name|response_schema/i.test(message);
}

export function questionsFromGemini(payload: unknown): {
  questions: JlptQuestion[];
  rawText: string;
  error?: string;
  /** True when JSON was truncated and only complete question objects were recovered. */
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

  const blocked = blockReason(payload);
  const text = extractText(payload);
  if (!text) {
    if (blocked) return { questions: [], rawText: "", error: blocked };
    return { questions: [], rawText: "", error: "Gemini returned no text for this photo." };
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    return { questions: [], rawText: text, error: blocked ?? "Gemini returned JSON that could not be parsed." };
  }

  return { questions: parsed.questions, rawText: text, error: blocked, partial: parsed.partial };
}

function parseModelJson(text: string): (JlptAnalyzePayload & { partial?: boolean }) | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const slice = candidate.slice(start);
  try {
    const normalized = normalizeJlptValue(JSON.parse(slice) as unknown);
    return normalized ? { ...normalized, partial: false } : null;
  } catch {
    const recovered = recoverPartialJlptQuestions(slice);
    return recovered;
  }
}

/** Salvage complete question objects from truncated Gemini JSON. */
export function recoverPartialJlptQuestions(text: string): (JlptAnalyzePayload & { partial: true }) | null {
  const questionsIdx = text.search(/"questions"\s*:\s*\[/);
  let cursor = -1;
  if (questionsIdx >= 0) {
    cursor = text.indexOf("[", questionsIdx);
  } else {
    const rootArray = text.trimStart().startsWith("[") ? 0 : text.search(/\[[\s\S]*"mondai_type"/);
    cursor = rootArray;
  }
  if (cursor < 0) return null;

  const questions: JlptQuestion[] = [];
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
      // skip malformed fragment
    }
    i = extracted.end;
  }

  if (questions.length === 0) return null;
  questions.sort((a, b) => a.mondai_type - b.mondai_type || a.question_number - b.question_number);
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
      if (depth === 0) return { json: text.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

export function mergeJlptQuestions(...lists: JlptQuestion[][]): JlptQuestion[] {
  const map = new Map<string, JlptQuestion>();
  for (const list of lists) {
    for (const question of list) {
      const key = `${question.mondai_type}:${question.question_number}`;
      const previous = map.get(key);
      if (!previous || questionCompleteness(question) >= questionCompleteness(previous)) {
        map.set(key, question);
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.mondai_type - b.mondai_type || a.question_number - b.question_number,
  );
}

function questionCompleteness(question: JlptQuestion): number {
  return (
    (question.japanese_sentence ? 3 : 0) +
    (question.target_word ? 1 : 0) +
    (question.correct_option ? 1 : 0) +
    (question.explanation_burmese ? 1 : 0) +
    question.options_table.length * 2 +
    question.furigana_tokens.length +
    question.options_table.reduce(
      (sum, row) => sum + (row.meaning_burmese ? 1 : 0) + (row.usage_burmese ? 1 : 0),
      0,
    )
  );
}

export function extractFinishReason(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const response = isRecord(payload.response) ? payload.response : payload;
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const first = candidates.find(isRecord);
  if (!first) return undefined;
  const reason = first.finishReason ?? first.finish_reason;
  return typeof reason === "string" ? reason : undefined;
}

export function isTruncationFinishReason(reason: string | undefined): boolean {
  if (!reason) return false;
  return /MAX_TOKENS|LENGTH|max.?token/i.test(reason);
}

function normalizeJlptValue(value: unknown): JlptAnalyzePayload | null {
  const list = questionList(value);
  if (!list) return null;
  const questions: JlptQuestion[] = [];
  for (const item of list) {
    const question = tidyQuestion(item);
    if (question) questions.push(question);
  }
  questions.sort((a, b) => a.mondai_type - b.mondai_type || a.question_number - b.question_number);
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

function tidyQuestion(value: unknown): JlptQuestion | null {
  if (!isRecord(value)) return null;

  const mondai_type = toMondaiType(value.mondai_type ?? value.mondaiType ?? value.type);
  if (mondai_type === null) return null;

  const question_number = toPositiveInt(value.question_number ?? value.questionNumber ?? value.number);
  if (question_number === null) return null;

  const options_table = tidyOptions(value.options_table ?? value.optionsTable ?? value.options);
  const japanese_sentence = asString(value.japanese_sentence ?? value.japaneseSentence ?? value.sentence);
  const furigana_tokens = tidyFuriganaTokens(
    value.furigana_tokens ?? value.furiganaTokens ?? value.tokens,
  );
  const target_word = asString(value.target_word ?? value.targetWord ?? value.target);
  const reading = asString(value.reading ?? value.furigana ?? value.yomi);
  const correct_option = asString(value.correct_option ?? value.correctOption ?? value.answer);
  const explanation_burmese = asString(
    value.explanation_burmese ?? value.explanationBurmese ?? value.explanation,
  );
  const nuance_note = asString(value.nuance_note ?? value.nuanceNote ?? value.nuance);

  if (!japanese_sentence && !target_word && options_table.length === 0) return null;

  const normalizedOptions = options_table.map((row) => {
    const isCorrect = row.option.trim() !== "" && row.option.trim() === correct_option.trim();
    return {
      ...row,
      // Prefer question-level reading for the correct option when the row omits it.
      reading: row.reading || (isCorrect ? reading : ""),
      why_wrong_burmese: isCorrect ? "" : row.why_wrong_burmese,
    };
  });

  return {
    mondai_type,
    question_number,
    japanese_sentence,
    furigana_tokens,
    target_word,
    reading,
    correct_option,
    options_table: normalizedOptions,
    explanation_burmese,
    nuance_note,
  };
}

function tidyFuriganaTokens(value: unknown): JlptFuriganaToken[] {
  if (!Array.isArray(value)) return [];
  const tokens: JlptFuriganaToken[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const surface = asString(item.surface ?? item.text ?? item.word ?? item.kanji);
    if (!surface) continue;
    const reading = asString(item.reading ?? item.furigana ?? item.yomi);
    tokens.push({ surface, reading });
  }
  return tokens;
}

function tidyOptions(value: unknown): JlptOptionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: JlptOptionRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const option = asString(item.option ?? item.number ?? item.label ?? item.id);
    const japanese = asString(item.japanese ?? item.text ?? item.word ?? item.kanji);
    const reading = asString(item.reading ?? item.furigana ?? item.yomi);
    const meaning_burmese = asString(
      item.meaning_burmese ?? item.meaningBurmese ?? item.burmese ?? item.meaning ?? item.myanmar,
    );
    const usage_burmese = asString(
      item.usage_burmese ?? item.usageBurmese ?? item.usage ?? item.context ?? item.collocation,
    );
    const why_wrong_burmese = asString(
      item.why_wrong_burmese ??
        item.whyWrongBurmese ??
        item.why_wrong ??
        item.whyWrong ??
        item.distractor_reason ??
        item.incorrect_reason,
    );
    if (!option && !japanese && !meaning_burmese) continue;
    rows.push({
      option,
      japanese,
      reading,
      meaning_burmese,
      usage_burmese,
      why_wrong_burmese,
    });
  }
  return rows;
}

function toMondaiType(value: unknown): JlptMondaiType | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6) {
    return value as JlptMondaiType;
  }
  if (typeof value === "string") {
    const match = value.trim().match(/([1-6])/);
    if (match?.[1]) return Number(match[1]) as JlptMondaiType;
  }
  return null;
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (n > 0) return n;
  }
  return null;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function extractText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();

  const response = isRecord(payload.response) ? payload.response : payload;
  const candidates = Array.isArray(response.candidates)
    ? response.candidates
    : Array.isArray(payload.candidates)
      ? payload.candidates
      : [];
  const chunks: string[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) continue;
    for (const part of candidate.content.parts) {
      if (isRecord(part) && typeof part.text === "string" && part.text.trim()) chunks.push(part.text);
    }
  }
  if (chunks.length) return chunks.join("\n").trim();

  const fromSteps = textFromSteps(payload.steps);
  return fromSteps;
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
      if (
        isRecord(part) &&
        (part.type === undefined || part.type === "text") &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
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
  const reason = extractFinishReason(payload);
  if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
    return "Gemini blocked the photo.";
  }
  return undefined;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
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
