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
  mergeJlptQuestions,
  normalizeImageMimeType,
  questionsFromGemini,
  recoverPartialJlptQuestions,
  JLPT_DEFAULT_GEMINI_MODEL,
  JLPT_MAX_OUTPUT_TOKENS,
} from "./gemini-jlpt";

const SAMPLE = {
  questions: [
    {
      mondai_type: 5,
      question_number: 12,
      japanese_sentence: "その計画は_____に終わった。",
      furigana_tokens: [
        { surface: "その", reading: "" },
        { surface: "計画", reading: "けいかく" },
        { surface: "は_____に終わった。", reading: "" },
      ],
      target_word: "失敗",
      reading: "しっぱい",
      meaning_burmese: "မအောင်မြင်ခြင်း",
      correct_option: "3",
      options_table: [
        {
          option: "1",
          japanese: "成功",
          reading: "せいこう",
          meaning_burmese: "အောင်မြင်ခြင်း",
          usage_burmese: "အောင်မြင်သည်ဟု သုံး",
          sentence_burmese: "",
          why_wrong_burmese: "ဆန့်ကျင်ဘက်",
        },
        {
          option: "2",
          japanese: "完成",
          reading: "かんせい",
          meaning_burmese: "ပြီးဆုံးခြင်း",
          usage_burmese: "ပြီးသည်ဟု သုံး",
          sentence_burmese: "",
          why_wrong_burmese: "မကိုက်ညီ",
        },
        {
          option: "3",
          japanese: "失敗",
          reading: "しっぱい",
          meaning_burmese: "မအောင်မြင်ခြင်း",
          usage_burmese: "မအောင်မြင်ဟု သုံး",
          sentence_burmese: "",
          why_wrong_burmese: "",
        },
        {
          option: "4",
          japanese: "継続",
          reading: "けいぞく",
          meaning_burmese: "ဆက်လက်လုပ်ခြင်း",
          usage_burmese: "ဆက်လုပ်သည်ဟု သုံး",
          sentence_burmese: "",
          why_wrong_burmese: "မကိုက်ညီ",
        },
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
  assert.equal(body.generationConfig.maxOutputTokens, JLPT_MAX_OUTPUT_TOKENS);
  assert.equal(JLPT_MAX_OUTPUT_TOKENS, 65_536);
  assert.equal("thinkingConfig" in body.generationConfig, false);
  assert.deepEqual(Object.keys(body.generationConfig).sort(), [
    "maxOutputTokens",
    "responseMimeType",
    "responseSchema",
    "temperature",
  ]);
  assert.ok("responseSchema" in body.generationConfig && body.generationConfig.responseSchema);
});

test("builds text-only JLPT body when textInput is provided", () => {
  const body = buildJlptGenerateContentBody("", "image/jpeg", {
    textInput: "問題4\n1 彼の話は_____。",
  });
  const textPart = body.contents[0]?.parts[1];
  assert.ok(textPart && "text" in textPart);
  assert.match(textPart.text, /問題4/);
  assert.equal(
    body.contents[0]?.parts.some((part) => "inline_data" in part),
    false,
  );
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
  assert.equal(result.questions[0]?.furigana_tokens[1]?.reading, "けいかく");
  assert.equal(result.questions[0]?.options_table[2]?.meaning_burmese, "မအောင်မြင်ခြင်း");
  assert.equal(result.questions[0]?.options_table[0]?.why_wrong_burmese, "ဆန့်ကျင်ဘက်");
  assert.equal(result.questions[0]?.options_table[2]?.why_wrong_burmese, "");
});

test("parses raw JSON text returned by response.text()", () => {
  const result = questionsFromGemini(JSON.stringify(SAMPLE));
  assert.equal(result.questions[0]?.correct_option, "3");
  assert.equal(result.questions[0]?.reading, "しっぱい");
});

test("accepts Mondai 1–6 and sorts; drops out-of-range types", () => {
  const result = questionsFromGemini(
    JSON.stringify({
      questions: [
        { ...SAMPLE.questions[0], mondai_type: 6, question_number: 2 },
        { ...SAMPLE.questions[0], mondai_type: 1, question_number: 3 },
        { ...SAMPLE.questions[0], mondai_type: 3, question_number: 1 },
        { ...SAMPLE.questions[0], mondai_type: 7, question_number: 1 },
        { ...SAMPLE.questions[0], mondai_type: 4, question_number: 9 },
        { ...SAMPLE.questions[0], mondai_type: 2, question_number: 5 },
      ],
    }),
  );
  assert.deepEqual(
    result.questions.map((q) => [q.mondai_type, q.question_number]),
    [
      [1, 3],
      [2, 5],
      [3, 1],
      [4, 9],
      [6, 2],
    ],
  );
});

test("backfills option reading from question reading for the correct choice", () => {
  const result = questionsFromGemini(
    JSON.stringify({
      questions: [
        {
          ...SAMPLE.questions[0],
          options_table: SAMPLE.questions[0].options_table.map((row) =>
            row.option === "3" ? { ...row, reading: "" } : row,
          ),
        },
      ],
    }),
  );
  assert.equal(result.questions[0]?.options_table[2]?.reading, "しっぱい");
});

test("Mondai 6 collapses dumped usage sentences to the headword and keeps short meaning", () => {
  const result = questionsFromGemini(
    JSON.stringify({
      questions: [
        {
          mondai_type: 6,
          question_number: 28,
          japanese_sentence:
            "掲示1 山田氏は有名な科学者で、いくつもの本に研究論文を掲示している。2 テレビでよく掲示されている洗剤が安くなっていたので、試しに買ってみた。3最近は名刺に自分の写真を掲示しているビジネスマンも多い。4 マンションの入り口に、水道工事の知らせが掲示されていた。",
          furigana_tokens: [{ surface: "掲示", reading: "けいじ" }],
          target_word: "掲示",
          reading: "けいじ",
          meaning_burmese: "ကြေညာစာကပ်ခြင်း",
          correct_option: "4",
          options_table: [
            {
              option: "1",
              japanese: "山田氏は有名な科学者で、いくつもの本に研究論文を掲示している。",
              reading: "",
              meaning_burmese: "ကြေညာစာကပ်ခြင်း",
              usage_burmese: "",
              sentence_burmese: "",
              why_wrong_burmese: "စာတမ်းကို တင်သည်ဟု မသုံး",
            },
            {
              option: "2",
              japanese: "テレビでよく掲示されている洗剤が安くなっていたので、試しに買ってみた。",
              reading: "",
              meaning_burmese: "ကြေညာစာကပ်ခြင်း",
              usage_burmese: "",
              sentence_burmese: "",
              why_wrong_burmese: "ကြော်ငြာကို ပြသည်ဟု မသုံး",
            },
            {
              option: "3",
              japanese: "最近は名刺に自分の写真を掲示しているビジネスマンも多い。",
              reading: "",
              meaning_burmese: "ကြေညာစာကပ်ခြင်း",
              usage_burmese: "",
              sentence_burmese: "",
              why_wrong_burmese: "ဓာတ်ပုံကို ကတ်ပေါ် တင်သည်ဟု မသုံး",
            },
            {
              option: "4",
              japanese: "マンションの入り口に、水道工事の知らせが掲示されていた。",
              reading: "",
              meaning_burmese: "ကြေညာစာကပ်ခြင်း",
              usage_burmese: "အကြောင်းကြားစာ ကပ်ထားသည်",
              sentence_burmese: "",
              why_wrong_burmese: "",
            },
          ],
          explanation_burmese: "အကြောင်းကြားစာကို နံရံတွင် ကပ်သည်ဟု ဆိုလိုသည်။",
          nuance_note: "",
        },
      ],
    }),
  );
  assert.equal(result.questions[0]?.japanese_sentence, "掲示");
  assert.equal(result.questions[0]?.meaning_burmese, "ကြေညာစာကပ်ခြင်း");
  assert.equal(result.questions[0]?.target_word, "掲示");
});

test("parser guard shortens question meaning_burmese only; 意味 table options stay intact", () => {
  const result = questionsFromGemini(
    JSON.stringify({
      questions: [
        {
          ...SAMPLE.questions[0],
          meaning_burmese: "မအောင်မြင်ခြင်းသည်။",
          options_table: [
            {
              option: "1",
              japanese: "成功",
              reading: "せいこう",
              meaning_burmese: "အောင်မြင်ခြင်း၊ အောင်မြင်မှု။",
              usage_burmese: "အောင်မြင်သည်ဟု သုံး",
              sentence_burmese: "",
              why_wrong_burmese: "ဆန့်ကျင်ဘက်",
            },
            {
              option: "2",
              japanese: "完成",
              reading: "かんせい",
              meaning_burmese: "ပြီးဆုံးခြင်း၊ ပြီးမြောက်ခြင်း။",
              usage_burmese: "ပြီးသည်ဟု သုံး",
              sentence_burmese: "",
              why_wrong_burmese: "မကိုက်ညီ",
            },
            {
              option: "3",
              japanese: "失敗",
              reading: "しっぱい",
              meaning_burmese: "မအောင်မြင်ခြင်း၊ ရှုံးနိမ့်ခြင်း။",
              usage_burmese: "မအောင်မြင်ဟု သုံး",
              sentence_burmese: "",
              why_wrong_burmese: "",
            },
            SAMPLE.questions[0].options_table[3],
          ],
        },
      ],
    }),
  );
  assert.equal(result.questions[0]?.meaning_burmese, "မအောင်မြင်ခြင်း");
  assert.equal(result.questions[0]?.options_table[0]?.meaning_burmese, "အောင်မြင်ခြင်း၊ အောင်မြင်မှု။");
  assert.equal(result.questions[0]?.options_table[1]?.meaning_burmese, "ပြီးဆုံးခြင်း၊ ပြီးမြောက်ခြင်း။");
  assert.equal(result.questions[0]?.options_table[2]?.meaning_burmese, "မအောင်မြင်ခြင်း၊ ရှုံးနိမ့်ခြင်း။");
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

test("recovers complete questions from truncated JSON", () => {
  const truncated = `{
  "questions": [
    ${JSON.stringify(SAMPLE.questions[0])},
    {
      "mondai_type": 4,
      "question_number": 2,
      "japanese_sentence": "途中で切れた
`;
  const recovered = recoverPartialJlptQuestions(truncated);
  assert.ok(recovered);
  assert.equal(recovered.partial, true);
  assert.equal(recovered.questions.length, 1);
  assert.equal(recovered.questions[0]?.target_word, "失敗");

  const fromGemini = questionsFromGemini(truncated);
  assert.equal(fromGemini.partial, true);
  assert.equal(fromGemini.questions.length, 1);
});

test("merges Mondai batch results without losing questions", () => {
  const a = { ...SAMPLE.questions[0], mondai_type: 1 as const, question_number: 1 };
  const b = { ...SAMPLE.questions[0], mondai_type: 5 as const, question_number: 2, explanation_burmese: "" };
  const bFull = { ...b, explanation_burmese: "ပြည့်စုံ" };
  const merged = mergeJlptQuestions([a, b], [bFull]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.mondai_type, 1);
  assert.equal(merged[1]?.explanation_burmese, "ပြည့်စုံ");
});

test("scopes prompt when mondaiTypes are provided", () => {
  const body = buildJlptGenerateContentBody("YWJj", "image/jpeg", { mondaiTypes: [5, 6] });
  const textPart = body.contents[0]?.parts[0];
  assert.ok(textPart && "text" in textPart && typeof textPart.text === "string");
  assert.match(textPart.text, /問題5・6/);
  assert.match(textPart.text, /1問も漏らさず/);
});

