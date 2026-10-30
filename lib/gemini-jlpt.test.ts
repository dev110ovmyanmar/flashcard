import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJlptGeminiRequest, questionsFromGemini } from "./gemini-jlpt";

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

test("reads structured JLPT questions from an Interactions response", () => {
  const result = questionsFromGemini({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(SAMPLE) }] }],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0]?.mondai_type, 5);
  assert.equal(result.questions[0]?.question_number, 12);
  assert.equal(result.questions[0]?.target_word, "失敗");
  assert.equal(result.questions[0]?.options_table[2]?.meaning_burmese, "မအောင်မြင်ခြင်း");
});

test("accepts a bare JSON array of questions", () => {
  const result = questionsFromGemini({
    output_text: JSON.stringify(SAMPLE.questions),
  });
  assert.equal(result.questions[0]?.correct_option, "3");
  assert.equal(result.questions[0]?.reading, "しっぱい");
});

test("filters non Mondai 4–6 entries and sorts", () => {
  const result = questionsFromGemini({
    output_text: JSON.stringify({
      questions: [
        { ...SAMPLE.questions[0], mondai_type: 6, question_number: 2 },
        { ...SAMPLE.questions[0], mondai_type: 3, question_number: 1 },
        { ...SAMPLE.questions[0], mondai_type: 4, question_number: 9 },
      ],
    }),
  });
  assert.deepEqual(
    result.questions.map((q) => [q.mondai_type, q.question_number]),
    [
      [4, 9],
      [6, 2],
    ],
  );
});

test("buildJlptGeminiRequest uses JSON response_format schema", () => {
  const body = buildJlptGeminiRequest("abc", "image/jpeg", "gemini-3.5-flash-lite");
  assert.equal(body.response_format?.mime_type, "application/json");
  assert.ok(body.response_format?.schema);
  assert.equal((body.input[0] as { text: string }).text.includes("問題4"), true);
});
