import {
  JLPT_N2_SYSTEM_PROMPT,
  type JlptAnalyzePayload,
  type JlptMondaiType,
  type JlptOptionRow,
  type JlptQuestion,
} from "@/src/constants/jlptPrompt";
import {
  DEFAULT_GEMINI_MODEL,
  geminiErrorMessage,
  nextGeminiAttempt,
  thinkingLevelFor,
  type GeminiAttempt,
} from "@/lib/gemini-ocr";

export { geminiErrorMessage, nextGeminiAttempt, type GeminiAttempt };

const JLPT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mondai_type: { type: "integer", enum: [4, 5, 6] },
          question_number: { type: "integer" },
          japanese_sentence: { type: "string" },
          target_word: { type: "string" },
          reading: { type: "string" },
          correct_option: { type: "string" },
          options_table: {
            type: "array",
            items: {
              type: "object",
              properties: {
                option: { type: "string" },
                japanese: { type: "string" },
                meaning_burmese: { type: "string" },
              },
              required: ["option", "japanese", "meaning_burmese"],
            },
          },
          explanation_burmese: { type: "string" },
          nuance_note: { type: "string" },
        },
        required: [
          "mondai_type",
          "question_number",
          "japanese_sentence",
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

function generationThinking(model: string): { thinking_level: "minimal" | "low" } | Record<string, never> {
  const level = thinkingLevelFor(model);
  return level ? { thinking_level: level } : {};
}

export function buildJlptGeminiRequest(
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
      { type: "text", text: JLPT_N2_SYSTEM_PROMPT },
      { type: "image", data: imageBase64, mime_type: mimeType },
    ],
    ...(structured
      ? {
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: JLPT_RESPONSE_SCHEMA,
          },
        }
      : {}),
    generation_config: {
      max_output_tokens: 8192,
      ...(thinking ? generationThinking(model) : {}),
    },
  };
}

export function questionsFromGemini(payload: unknown): {
  questions: JlptQuestion[];
  rawText: string;
  error?: string;
} {
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

  return { questions: parsed.questions, rawText: text, error: blocked };
}

function parseModelJson(text: string): JlptAnalyzePayload | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  try {
    return normalizeJlptValue(JSON.parse(candidate.slice(start)) as unknown);
  } catch {
    return null;
  }
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
  const target_word = asString(value.target_word ?? value.targetWord ?? value.target);
  const reading = asString(value.reading ?? value.furigana ?? value.yomi);
  const correct_option = asString(value.correct_option ?? value.correctOption ?? value.answer);
  const explanation_burmese = asString(
    value.explanation_burmese ?? value.explanationBurmese ?? value.explanation,
  );
  const nuance_note = asString(value.nuance_note ?? value.nuanceNote ?? value.nuance);

  if (!japanese_sentence && !target_word && options_table.length === 0) return null;

  return {
    mondai_type,
    question_number,
    japanese_sentence,
    target_word,
    reading,
    correct_option,
    options_table,
    explanation_burmese,
    nuance_note,
  };
}

function tidyOptions(value: unknown): JlptOptionRow[] {
  if (!Array.isArray(value)) return [];
  const rows: JlptOptionRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const option = asString(item.option ?? item.number ?? item.label ?? item.id);
    const japanese = asString(item.japanese ?? item.text ?? item.word ?? item.kanji);
    const meaning_burmese = asString(
      item.meaning_burmese ?? item.meaningBurmese ?? item.burmese ?? item.meaning ?? item.myanmar,
    );
    if (!option && !japanese && !meaning_burmese) continue;
    rows.push({ option, japanese, meaning_burmese });
  }
  return rows;
}

function toMondaiType(value: unknown): JlptMondaiType | null {
  if (typeof value === "number" && (value === 4 || value === 5 || value === 6)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/([456])/);
    if (match?.[1] === "4" || match?.[1] === "5" || match?.[1] === "6") {
      return Number(match[1]) as JlptMondaiType;
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
