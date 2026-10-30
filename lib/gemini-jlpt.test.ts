import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGenerateContentUrl,
  buildJlptGenerateContentBody,
  buildJlptImageParts,
  cleanImageBase64,
  googleGenerativeAiErrorMessage,
  jlptGeminiModelChain,
  jlptGeminiModelName,
  normalizeImageMimeType,
  questionsFromGemini,
  JLPT_DEFAULT_GEMINI_MODEL,
} from "./gemini-jlpt";

const SAMPLE = {
  questions: [
    {
      mondai_type: 5,
      question_number: 12,
      japanese_sentence: "その計画は_____に終わった。",
      target_word: "失敗",
      reading: "しっぱい",
      correct_option: "3",
      options_table: [
        { option: "1", japanese: "成功", meaning_burmese: "အောင်မြင်ခြင်း" },
        { option: "2", japanese: "完成", meaning_burmese: "ပြီးဆုံးခြင်း" },
        { option: "3", japanese: "失敗", meaning_burmese: "မအောင်မြင်ခြင်း" },
        { option: "4", japanese: "継続", meaning_burmese: "ဆက်လက်လုပ်ခြင်း" },
      ],
      explanation_burmese: "ဝါကျအရ အစီအစဉ် မအောင်မြင်ခဲ့သည်ဟု ဆိုလိုသည်။",
      nuance_note: "成功 သည် ဆန့်ကျင်ဘက်ဖြစ်သည်။",
    },
  ],
};

test("defaults to gemini-3.5-flash-lite and keeps supported fallbacks", () => {
  assert.equal(JLPT_DEFAULT_GEMINI_MODEL, "gemini-3.5-flash-lite");
  assert.equal(jlptGeminiModelName(undefined), "gemini-3.5-flash-lite");
  assert.deepEqual(jlptGeminiModelChain(undefined).slice(0, 3), [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
  ]);
});

test("builds the official generateContent URL with model and key", () => {
  const url = buildGenerateContentUrl("gemini-3.5-flash-lite", "test-key");
  assert.equal(
    url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=test-key",
  );
});

test("builds REST inline_data image parts with cleaned base64 and jpeg mime", () => {
  const body = buildJlptGenerateContentBody("data:image/jpg;base64,YWJjZA==\n", "image/jpg");
  const imagePart = body.contents[0]?.parts[1];
  assert.ok(imagePart && "inline_data" in imagePart && imagePart.inline_data);
  assert.equal(imagePart.inline_data.mime_type, "image/jpeg");
  assert.equal(imagePart.inline_data.data, "YWJjZA==");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.temperature, 0.2);
  assert.equal(body.generationConfig.maxOutputTokens, 4096);
  assert.equal("thinkingConfig" in body.generationConfig, false);
  assert.deepEqual(Object.keys(body.generationConfig).sort(), [
    "maxOutputTokens",
    "responseMimeType",
    "responseSchema",
    "temperature",
  ]);
  assert.ok("responseSchema" in body.generationConfig && body.generationConfig.responseSchema);
});

test("legacy SDK-shaped parts helper still normalizes mime", () => {
  const parts = buildJlptImageParts("data:image/jpg;base64,YWJjZA==\n", "image/jpg");
  assert.equal(parts[1].inlineData.mimeType, "image/jpeg");
  assert.equal(parts[1].inlineData.data, "YWJjZA==");
});

test("normalizes mime types and data URLs", () => {
  assert.equal(normalizeImageMimeType("image/JPG"), "image/jpeg");
  assert.equal(cleanImageBase64("data:image/png;base64,QQ=="), "QQ==");
});

test("reads structured JLPT questions from a generateContent candidate payload", () => {
  const result = questionsFromGemini({
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(SAMPLE) }],
        },
        finishReason: "STOP",
      },
    ],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0]?.mondai_type, 5);
  assert.equal(result.questions[0]?.question_number, 12);
  assert.equal(result.questions[0]?.target_word, "失敗");
  assert.equal(result.questions[0]?.options_table[2]?.meaning_burmese, "မအောင်မြင်ခြင်း");
});

test("parses raw JSON text returned by response.text()", () => {
  const result = questionsFromGemini(JSON.stringify(SAMPLE));
  assert.equal(result.questions[0]?.correct_option, "3");
  assert.equal(result.questions[0]?.reading, "しっぱい");
});

test("filters non Mondai 4–6 entries and sorts", () => {
  const result = questionsFromGemini(
    JSON.stringify({
      questions: [
        { ...SAMPLE.questions[0], mondai_type: 6, question_number: 2 },
        { ...SAMPLE.questions[0], mondai_type: 3, question_number: 1 },
        { ...SAMPLE.questions[0], mondai_type: 4, question_number: 9 },
      ],
    }),
  );
  assert.deepEqual(
    result.questions.map((q) => [q.mondai_type, q.question_number]),
    [
      [4, 9],
      [6, 2],
    ],
  );
});

test("extracts exact Gemini API error messages", () => {
  const message = googleGenerativeAiErrorMessage({
    message: "[GoogleGenerativeAI Error]: fetch failed",
    status: 404,
    statusText: "Not Found",
    errorDetails: [{ reason: "MODEL_NOT_FOUND", message: "models/gemini-2.5-flash is not found" }],
  });
  assert.match(message, /fetch failed|MODEL_NOT_FOUND|not found/i);
});
