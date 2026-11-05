import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GRAMMAR_DEFAULT_GEMINI_MODEL,
  GRAMMAR_MAX_OUTPUT_TOKENS,
  GRAMMAR_MAX_TEXT_CHARS,
  GRAMMAR_RESPONSE_SCHEMA,
  grammarGeminiModelChain,
  grammarGeminiModelName,
  mergeGrammarQuestions,
  normalizeCorrectOrder,
  normalizeGrammarTextInput,
  questionsFromGrammarGemini,
  recoverPartialGrammarQuestions,
  shortGrammarMeaning,
  stripRelatedGrammarMetaPrefix,
} from "./gemini-grammar";
import { Type } from "@google/genai";
import type { GrammarQuestion } from "@/src/constants/grammarPrompt";

describe("normalizeGrammarTextInput", () => {
  it("trims, normalizes newlines, and caps length", () => {
    assert.equal(normalizeGrammarTextInput("  a\r\nb\u0000  "), "a\nb");
    assert.equal(normalizeGrammarTextInput("x".repeat(GRAMMAR_MAX_TEXT_CHARS + 10)).length, GRAMMAR_MAX_TEXT_CHARS);
  });
});

describe("grammarGeminiModelName", () => {
  it("defaults to gemini-3.5-flash-lite (2.5-flash is retired)", () => {
    assert.equal(GRAMMAR_DEFAULT_GEMINI_MODEL, "gemini-3.5-flash-lite");
    assert.equal(grammarGeminiModelName(undefined), "gemini-3.5-flash-lite");
    assert.equal(grammarGeminiModelName(""), "gemini-3.5-flash-lite");
  });

  it("accepts a custom model and strips models/ prefix", () => {
    assert.equal(grammarGeminiModelName("models/gemini-3.5-flash"), "gemini-3.5-flash");
  });
});

describe("grammarGeminiModelChain", () => {
  it("puts the preferred model first without duplicates and skips retired 2.5", () => {
    const chain = grammarGeminiModelChain("gemini-3.5-flash");
    assert.equal(chain[0], "gemini-3.5-flash");
    assert.equal(chain.filter((m) => m === "gemini-3.5-flash").length, 1);
    assert.ok(!chain.includes("gemini-2.5-flash"));
  });
});

describe("GRAMMAR_MAX_OUTPUT_TOKENS", () => {
  it("matches JLPT headroom so a full grammar page is not truncated mid-response", () => {
    assert.equal(GRAMMAR_MAX_OUTPUT_TOKENS, 65_536);
  });
});

describe("GRAMMAR_RESPONSE_SCHEMA", () => {
  it("requires the rich Vocabulary-style grammar fields with usage + example_burmese", () => {
    assert.equal(GRAMMAR_RESPONSE_SCHEMA.type, Type.OBJECT);
    assert.deepEqual(GRAMMAR_RESPONSE_SCHEMA.required, ["questions"]);
    const item = GRAMMAR_RESPONSE_SCHEMA.properties?.questions?.items;
    assert.ok(item);
    assert.deepEqual(item.required, [
      "questionNumber",
      "questionText",
      "correctAnswer",
      "correct_order",
      "assembled_sentence",
      "grammarPattern",
      "grammar_meaning_burmese",
      "options_table",
      "explanation_burmese",
      "related_grammar_burmese",
    ]);
    const options = item.properties?.options_table?.items;
    assert.ok(options);
    assert.deepEqual(options.required, [
      "option",
      "japanese",
      "reading",
      "meaning_burmese",
      "usage_burmese",
      "example_sentence",
      "example_burmese",
    ]);
  });
});

describe("stripRelatedGrammarMetaPrefix", () => {
  it("removes ပြင်ပရောတတ်သည့်ပုံစံ prefixes", () => {
    assert.equal(
      stripRelatedGrammarMetaPrefix(
        "ပြင်ပရောတတ်သည့်ပုံစံ: ～べきだ《べきだ》 က တာဝန်။",
      ),
      "～べきだ《べきだ》 က တာဝန်။",
    );
    assert.equal(
      stripRelatedGrammarMetaPrefix("ပြင်ပရောတတ်သည့်ပုံစ ～ほうがいい။"),
      "～ほうがいい။",
    );
    assert.equal(
      stripRelatedGrammarMetaPrefix("～べきだ《べきだ》 က တာဝန်။"),
      "～べきだ《べきだ》 က တာဝန်။",
    );
  });
});

describe("normalizeCorrectOrder", () => {
  it("normalizes star arrangement orders", () => {
    assert.equal(normalizeCorrectOrder("2-4-1-3"), "2-4-1-3");
    assert.equal(normalizeCorrectOrder("2 → 4 → 1 → 3"), "2-4-1-3");
    assert.equal(normalizeCorrectOrder("2413"), "2-4-1-3");
    assert.equal(normalizeCorrectOrder("2 4 1 3"), "2-4-1-3");
    assert.equal(normalizeCorrectOrder(""), "");
  });
});

describe("shortGrammarMeaning", () => {
  it("keeps punchy slash-alternate cores", () => {
    assert.equal(shortGrammarMeaning("သင့်သည် / လိုက်ပါ"), "သင့်သည် / လိုက်ပါ");
    assert.equal(shortGrammarMeaning("လျက်နဲ့ / ရဲ့သားနဲ့"), "လျက်နဲ့ / ရဲ့သားနဲ့");
    assert.equal(shortGrammarMeaning("လက်စ"), "လက်စ");
  });

  it("peels long sentence dumps down to a short core", () => {
    const long =
      "ကျန်းမာရေးအတွက် စောအိပ်စောထရန် သင့်သည်ဟု အကြံပေးသောကြောင့် သုံးသည်။";
    const short = shortGrammarMeaning(long);
    assert.ok([...short].length < [...long].length);
    assert.ok(!/သောကြောင့်/.test(short));
  });
});

describe("questionsFromGrammarGemini", () => {
  it("parses ★ arrangement correct_order and assembled_sentence", () => {
    const raw = JSON.stringify({
      questions: [
        {
          questionNumber: "★1",
          questionText: "彼は＿＿＿★＿＿＿＿＿＿＿＿＿＿。\n1. 行く\n2. ことに\n3. 明日\n4. した",
          correctAnswer: "2",
          correct_order: "3 → 2 → 1 → 4",
          assembled_sentence: "彼《かれ》は明日《あした》行く《いく》ことにした。",
          grammarPattern: "～ことにする《ことにする》",
          grammar_meaning_burmese: "ဆုံးဖြတ်သည်",
          options_table: [
            {
              option: "1",
              japanese: "行く",
              reading: "いく",
              meaning_burmese: "သွားသည်",
              usage_burmese: "ရွေ့လျားမှု။",
              example_sentence: "学校《がっこう》へ行《い》く。",
              example_burmese: "ကျောင်းသွားသည်။",
            },
          ],
          explanation_burmese: "『သွားရန် ဆုံးဖြတ်သည်』ဖြစ်သောကြောင့် စီစဉ်မှု ၃-၂-၁-၄။ ★ မှာ ၂။",
          related_grammar_burmese: "",
        },
      ],
    });
    const parsed = questionsFromGrammarGemini(raw);
    assert.equal(parsed.questions[0]?.correct_order, "3-2-1-4");
    assert.equal(parsed.questions[0]?.correctAnswer, "2");
    assert.match(parsed.questions[0]?.assembled_sentence ?? "", /明日/);
  });

  it("parses a rich options_table payload with direct AI N2 meanings (no glossary)", () => {
    const raw = JSON.stringify({
      questions: [
        {
          questionNumber: "1",
          questionText: "健康を保つためには、早寝早起きの_____。\n1. ことだ\n2. わけだ",
          correctAnswer: "1",
          grammarPattern: "～ことだ《ことだ》",
          grammar_meaning_burmese: "သင့်သည် / လိုက်ပါ",
          options_table: [
            {
              option: "1",
              japanese: "ことだ",
              reading: "ことだ",
              meaning_burmese: "သင့်သည် / လိုက်ပါ",
              usage_burmese: "အကြံပေးသည့်အခါ သုံးသည်။",
              example_sentence: "疲《つか》れたときは、ゆっくり休《やす》むことだ。",
              example_burmese: "ပင်ပန်းသောအခါ အနားယူသင့်သည်။",
            },
            {
              option: "2",
              japanese: "わけだ",
              reading: "わけだ",
              meaning_burmese: "အကြောင်းရင်း / ဆိုလိုသည်",
              usage_burmese: "နိဂုံးချုပ်ကို ပြသည်။",
              example_sentence: "雨《あめ》が降《ふ》っているから混《こ》んでいるわけだ。",
              example_burmese: "မိုးရွာသောကြောင့် ပိတ်နေသည်ဟု ဆိုလိုသည်။",
            },
          ],
          explanation_burmese: "လုပ်သင့်သည်ဟု အကြံပေးသောကြောင့် ことだ က 正解။",
          related_grammar_burmese: "～べきだ《べきだ》 က တာဝန်။",
        },
      ],
    });
    const parsed = questionsFromGrammarGemini(raw);
    assert.equal(parsed.questions.length, 1);
    assert.equal(parsed.questions[0]?.grammarPattern, "～ことだ《ことだ》");
    // Direct AI gloss kept as-is (no glossary override).
    assert.equal(parsed.questions[0]?.grammar_meaning_burmese, "သင့်သည် / လိုက်ပါ");
    assert.equal(parsed.questions[0]?.correctAnswer, "1");
    assert.equal(parsed.questions[0]?.options_table.length, 2);
    assert.equal(parsed.questions[0]?.options_table[0]?.example_burmese, "ပင်ပန်းသောအခါ အနားယူသင့်သည်။");
  });

  it("keeps short Gemini meaning for header Line 2", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          questionNumber: "9",
          questionText: "未知の_____。\n1. ざあざあ\n2. ののの",
          correctAnswer: "1",
          grammarPattern: "～まったく知らない形《まったくしらないかたち》",
          grammar_meaning_burmese: "တိုတို အဓိပ္ပာယ်",
          options_table: [],
          explanation_burmese: "—",
          related_grammar_burmese: "",
        },
      ],
    });
    assert.equal(parsed.questions[0]?.grammar_meaning_burmese, "တိုတို အဓိပ္ပာယ်");
  });

  it("falls back header meaning from correct option when header field missing", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          questionNumber: "3",
          questionText: "未知_____。\n1. aaa\n2. bbb",
          correctAnswer: "2",
          grammarPattern: "～未知専用パターン",
          options_table: [
            {
              option: "1",
              japanese: "aaa",
              reading: "",
              meaning_burmese: "အေ",
              usage_burmese: "",
              example_sentence: "",
              example_burmese: "",
            },
            {
              option: "2",
              japanese: "bbb",
              reading: "",
              meaning_burmese: "ဘီဘီ / စီစီ",
              usage_burmese: "အသုံး။",
              example_sentence: "例文。",
              example_burmese: "ဥပမာ။",
            },
          ],
          explanation_burmese: "—",
          related_grammar_burmese: "",
        },
      ],
    });
    assert.equal(parsed.questions[0]?.grammar_meaning_burmese, "ဘီဘီ / စီစီ");
  });

  it("normalizes snake_case keys and legacy flat distractors", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          question_number: "★2",
          question_text: "テスト文\n1. ものなら\n2. ものか",
          correct_answer: "1",
          grammar_pattern: "～ものなら",
          correct_reason_burmese: "မှန်",
          incorrect_reasons_burmese:
            "2 ものか: မကိုက်ညီ။ 例: そんなことできるものか。",
        },
      ],
    });
    assert.equal(parsed.questions[0]?.questionNumber, "★2");
    assert.equal(parsed.questions[0]?.grammarPattern, "～ものなら");
    assert.equal(parsed.questions[0]?.explanation_burmese, "မှန်");
    assert.equal(parsed.questions[0]?.options_table.length, 2);
    assert.equal(parsed.questions[0]?.options_table[1]?.option, "2");
    assert.match(parsed.questions[0]?.options_table[1]?.example_sentence ?? "", /ものか/);
  });

  it("returns an error for empty payloads", () => {
    const parsed = questionsFromGrammarGemini(null);
    assert.equal(parsed.questions.length, 0);
    assert.ok(parsed.error);
  });

  it("strips Korean and English glosses from Burmese fields", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          questionNumber: "1",
          questionText: "忙しい_____。\n1. ばかりか\n2. わけだ",
          correctAnswer: "1",
          grammarPattern: "～ばかりか《ばかりか》",
          grammar_meaning_burmese: "뿐만 아니라 / ထို့အပြင်",
          options_table: [
            {
              option: "1",
              japanese: "ばかりか",
              reading: "ばかりか",
              meaning_burmese: "뿐만 아니라 / ထို့အပြင်",
              usage_burmese: "ပင်ပန်းသည်သာမက 뿐만 아니라 အလုပ်များသည်။",
              example_sentence: "忙しいばかりか、疲れている。",
              example_burmese: "အလုပ်များသည်သာမက ပင်ပန်းသည်။ (not only)",
            },
            {
              option: "2",
              japanese: "わけだ",
              reading: "わけだ",
              meaning_burmese: "အကြောင်းရင်း",
              usage_burmese: "",
              example_sentence: "",
              example_burmese: "",
            },
          ],
          explanation_burmese: "뿐만 아니라 / ထို့အပြင် ဟု ဆိုသည်။",
          related_grammar_burmese: "",
        },
      ],
    });
    const q = parsed.questions[0];
    assert.ok(q);
    assert.equal(q.grammar_meaning_burmese.includes("뿐만"), false);
    assert.match(q.grammar_meaning_burmese, /ထို့အပြင်/);
    assert.equal(q.options_table[0]?.meaning_burmese.includes("뿐만"), false);
    assert.equal(q.options_table[0]?.usage_burmese.includes("뿐만"), false);
    assert.equal(q.options_table[0]?.example_burmese.includes("not only"), false);
    assert.equal(q.explanation_burmese.includes("뿐만"), false);
  });

  it("strips ပြင်ပရောတတ်သည့်ပုံစံ meta prefix from related_grammar_burmese", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          questionNumber: "4",
          questionText: "_____。\n1. ことだ\n2. わけだ",
          correctAnswer: "1",
          grammarPattern: "～ことだ",
          grammar_meaning_burmese: "သင့်သည်",
          options_table: [],
          explanation_burmese: "",
          related_grammar_burmese:
            "ပြင်ပရောတတ်သည့်ပုံစံ: ～べきだ《べきだ》 က တာဝန်။",
        },
      ],
    });
    assert.equal(
      parsed.questions[0]?.related_grammar_burmese,
      "～べきだ《べきだ》 က တာဝန်။",
    );
  });

  it("strips Thai tokens like သัပတ from Burmese fields", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          questionNumber: "2",
          questionText: "今週_____。\n1. 中に\n2. うちに",
          correctAnswer: "1",
          grammarPattern: "～中に《ちゅうに》",
          grammar_meaning_burmese: "ဒီ သัပတ အတွင်း",
          options_table: [
            {
              option: "1",
              japanese: "中に",
              reading: "ちゅうに",
              meaning_burmese: "အတွင်း",
              usage_burmese: "ဒီสัปดาห์ အတွင်း လုပ်မည်။",
              example_sentence: "今週中にします。",
              example_burmese: "ဒီ သัပတ အတွင်း လုပ်မည်။",
            },
          ],
          explanation_burmese: "ဒီสัปดาห์ အတွင်း။",
          related_grammar_burmese: "",
        },
      ],
    });
    const q = parsed.questions[0];
    assert.ok(q);
    assert.equal(q.grammar_meaning_burmese.includes("ั"), false);
    assert.equal(q.grammar_meaning_burmese.includes("สัปดาห์"), false);
    assert.equal(q.options_table[0]?.usage_burmese.includes("สัปดาห์"), false);
    assert.equal(q.options_table[0]?.example_burmese.includes("ั"), false);
    assert.match(q.options_table[0]?.usage_burmese ?? "", /အတွင်း/);
    assert.match(q.explanation_burmese, /အတွင်း/);
  });

  it("recovers complete questions from truncated JSON", () => {
    const truncated = `{
  "questions": [
    {
      "questionNumber": "1",
      "questionText": "_____ことだ。",
      "correctAnswer": "1",
      "grammarPattern": "～ことだ《ことだ》",
      "grammar_meaning_burmese": "သင့်သည်",
      "options_table": [],
      "explanation_burmese": "အကြံပေးသည်။",
      "related_grammar_burmese": ""
    },
    {
      "questionNumber": "2",
      "questionText": "_____わけだ。",
      "correctAnswer": "2",
      "grammarPattern": "～わけだ《わけだ》",
      "grammar_meaning_burmese": "ဆိုလိုသည်",
      "options_table": [],
      "explanation_burmese": "နိဂုံး။",
      "related_grammar_burmese": ""
    },
    {
      "questionNumber": "3",
      "questionText": "incomplete`;
    const recovered = recoverPartialGrammarQuestions(truncated);
    assert.ok(recovered);
    assert.equal(recovered.partial, true);
    assert.equal(recovered.questions.length, 2);
    assert.equal(recovered.questions[0]?.questionNumber, "1");
    assert.equal(recovered.questions[1]?.questionNumber, "2");

    const parsed = questionsFromGrammarGemini(truncated);
    assert.equal(parsed.partial, true);
    assert.equal(parsed.questions.length, 2);
  });
});

describe("mergeGrammarQuestions", () => {
  it("dedupes by question number and keeps the richer row", () => {
    const thin: GrammarQuestion = {
      questionNumber: "1",
      questionText: "A",
      correctAnswer: "1",
      correct_order: "",
      assembled_sentence: "",
      grammarPattern: "～ことだ",
      grammar_meaning_burmese: "",
      options_table: [],
      explanation_burmese: "",
      related_grammar_burmese: "",
    };
    const rich: GrammarQuestion = {
      ...thin,
      grammar_meaning_burmese: "သင့်သည်",
      explanation_burmese: "ရှင်းပြချက်",
      options_table: [
        {
          option: "1",
          japanese: "ことだ",
          reading: "ことだ",
          meaning_burmese: "သင့်သည်",
          usage_burmese: "အကြံ",
          example_sentence: "休むことだ。",
          example_burmese: "အနားယူသင့်သည်။",
        },
      ],
    };
    const extra: GrammarQuestion = {
      ...thin,
      questionNumber: "2",
      questionText: "B",
      grammarPattern: "～わけだ",
    };

    const merged = mergeGrammarQuestions([thin, extra], [rich]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.questionNumber, "1");
    assert.equal(merged[0]?.options_table.length, 1);
    assert.equal(merged[0]?.explanation_burmese, "ရှင်းပြချက်");
    assert.equal(merged[1]?.questionNumber, "2");
  });
});
