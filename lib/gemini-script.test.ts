import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeScriptText,
  payloadFromScriptGemini,
  scriptGeminiModelChain,
  SCRIPT_DEFAULT_GEMINI_MODEL,
} from "./gemini-script";

const SAMPLE = {
  vocabulary: [
    {
      word: "打ち合わせ",
      reading: "うちあわせ",
      meaning_burmese: "ညှိနှိုင်းအစည်းအဝေး",
      explanation_burmese: "အလုပ်မစမီ ညှိနှိုင်းသော အစည်းအဝေး။",
      example_sentence: "明日《あした》の打ち合わせです。",
      jlpt_level: "N2",
    },
  ],
  grammar: [
    {
      pattern: "～てしまう《てしまう》",
      reading: "てしまう",
      explanation_burmese: "လုပ်ပြီးဖြစ်သွားသည်။",
      usage_in_script: "忘《わす》れてしまった。",
      usage_burmese: "မေ့သွားသည်ဟု ပြောသည်။",
      nuance_burmese: "နောင်တ ခံစားချက် ပါသည်။",
      context_example: "電車《でんしゃ》に傘《かさ》を忘《わす》れてしまった。",
      jlpt_level: "N3",
    },
  ],
};

test("defaults script model chain", () => {
  assert.equal(SCRIPT_DEFAULT_GEMINI_MODEL, "gemini-3.5-flash-lite");
  assert.equal(scriptGeminiModelChain(undefined)[0], "gemini-3.5-flash-lite");
  assert.ok(scriptGeminiModelChain("gemini-3.5-flash")[0] === "gemini-3.5-flash");
});

test("normalizes script text", () => {
  assert.equal(normalizeScriptText("  a\r\nb\u0000  "), "a\nb");
});

test("parses structured script JSON", () => {
  const parsed = payloadFromScriptGemini(JSON.stringify(SAMPLE));
  assert.equal(parsed.vocabulary.length, 1);
  assert.equal(parsed.vocabulary[0]?.word, "打ち合わせ");
  assert.equal(parsed.grammar.length, 1);
  assert.equal(parsed.grammar[0]?.reading, "てしまう");
  assert.equal(parsed.error, undefined);
});

test("accepts alternate vocabulary / grammar keys", () => {
  const parsed = payloadFromScriptGemini({
    goi: [{ word: "順調", reading: "じゅんちょう", meaning_burmese: "ချောမွေ့", jlpt_level: "N3" }],
    bunpou: [
      {
        pattern: "～ことになっている",
        reading: "ことになっている",
        explanation_burmese: "စည်းကမ်းအရ ဖြစ်ရမည်",
        usage_in_script: "靴《くつ》を脱《ぬ》ぐことになっている。",
        usage_burmese: "ဖိနပ်ချွတ်ရမည်ဟု ပြောသည်။",
        nuance_burmese: "ကိုယ်ပိုင်ဆုံးဖြတ်ချက်မဟုတ်",
        context_example: "会議《かいぎ》は月曜《げつよう》に行《おこな》うことになっている。",
        jlpt_level: "N3",
      },
    ],
  });
  assert.equal(parsed.vocabulary[0]?.word, "順調");
  assert.equal(parsed.grammar[0]?.pattern, "～ことになっている");
  assert.equal(parsed.grammar[0]?.usage_burmese, "ဖိနပ်ချွတ်ရမည်။");
  assert.equal(parsed.grammar[0]?.nuance_burmese, "ကိုယ်ပိုင်ဆုံးဖြတ်ချက်မဟုတ်");
  assert.match(parsed.grammar[0]?.context_example ?? "", /会議/);
});

test("parses fenced JSON", () => {
  const parsed = payloadFromScriptGemini(`\`\`\`json\n${JSON.stringify(SAMPLE)}\n\`\`\``);
  assert.equal(parsed.vocabulary.length, 1);
  assert.equal(parsed.grammar.length, 1);
});

test("strips Korean and English glosses from grammar Burmese fields", () => {
  const parsed = payloadFromScriptGemini({
    vocabulary: [],
    grammar: [
      {
        pattern: "～ばかりか《ばかりか》",
        reading: "ばかりか",
        explanation_burmese: "뿐만 아니라 / ထို့အပြင် (not only but also)",
        usage_in_script: "忙しいばかりか、疲れている。",
        usage_burmese: "ပင်ပန်းသည်သာမက 뿐만 아니라 အလုပ်များသည်။",
        nuance_burmese: "အလေးပေးပြောခြင်း — not only… but also",
        context_example: "高いばかりか、品質も悪い。",
        jlpt_level: "N2",
      },
    ],
  });
  const g = parsed.grammar[0];
  assert.ok(g);
  assert.equal(g.explanation_burmese.includes("뿐만"), false);
  assert.equal(g.explanation_burmese.includes("not only"), false);
  assert.match(g.explanation_burmese, /ထို့အပြင်/);
  assert.equal(g.usage_burmese.includes("뿐만"), false);
  assert.equal(g.nuance_burmese.includes("not only"), false);
});

test("strips Thai tokens like သัပတ from Burmese fields", () => {
  const parsed = payloadFromScriptGemini({
    vocabulary: [
      {
        word: "今週",
        reading: "こんしゅう",
        meaning_burmese: "ဒီ သัပတ",
        explanation_burmese: "ဒီสัปดาห์ အတွင်း လုပ်မည်။",
        example_sentence: "今週中にします。",
        jlpt_level: "N3",
      },
    ],
    grammar: [],
  });
  const v = parsed.vocabulary[0];
  assert.ok(v);
  assert.equal(v.meaning_burmese.includes("ั"), false);
  assert.equal(v.meaning_burmese.includes("สัปดาห์"), false);
  assert.equal(v.explanation_burmese.includes("สัปดาห์"), false);
  assert.match(v.explanation_burmese, /အတွင်း/);
});

test("keeps vocabulary and grammar across all JLPT levels", () => {
  const parsed = payloadFromScriptGemini({
    vocabulary: [
      {
        word: "打ち合わせ",
        reading: "うちあわせ",
        meaning_burmese: "ညှိနှိုင်း",
        explanation_burmese: "ညှိနှိုင်းမည်။",
        example_sentence: "打ち合わせです。",
        jlpt_level: "N2",
      },
      {
        word: "こんにちは",
        reading: "こんにちは",
        meaning_burmese: "မင်္ဂလာပါ",
        explanation_burmese: "မင်္ဂလာပါ။",
        example_sentence: "こんにちは。",
        jlpt_level: "N5",
      },
      {
        word: "齟齬",
        reading: "そご",
        meaning_burmese: "ကွဲလွဲမှု",
        explanation_burmese: "ကွဲလွဲသည်။",
        example_sentence: "齟齬がある。",
        jlpt_level: "N1",
      },
    ],
    grammar: [
      {
        pattern: "～ばかりか",
        reading: "ばかりか",
        explanation_burmese: "သာမက",
        usage_in_script: "忙しいばかりか。",
        usage_burmese: "အလုပ်များသည်သာမက။",
        nuance_burmese: "အလေးပေး",
        context_example: "高いばかりか。",
        jlpt_level: "N2",
      },
      {
        pattern: "～てしまう",
        reading: "てしまう",
        explanation_burmese: "ဖြစ်သွား",
        usage_in_script: "忘れてしまった。",
        usage_burmese: "မေ့သွားသည်။",
        nuance_burmese: "နောင်တ",
        context_example: "傘を忘れてしまった。",
        jlpt_level: "N4",
      },
    ],
  });
  assert.equal(parsed.vocabulary.length, 3);
  assert.deepEqual(
    parsed.vocabulary.map((row) => row.jlpt_level),
    ["N2", "N5", "N1"],
  );
  assert.equal(parsed.grammar.length, 2);
});

test("strips repeated meta speech endings from vocab explanations", () => {
  const parsed = payloadFromScriptGemini({
    vocabulary: [
      {
        word: "スケジュール表",
        reading: "スケジュールひょう",
        meaning_burmese: "အချိန်ဇယား",
        explanation_burmese:
          "ထိုနေ့အတွက် ဝန်ထမ်းများသုံးမည့် အချိန်ဇယားကို လိုချင်သည်ဟု ပြောနေသည်။",
        example_sentence: "当日のスタッフ用のスケジュール表が欲しい。",
        jlpt_level: "N2",
      },
    ],
    grammar: [],
  });
  const v = parsed.vocabulary[0];
  assert.ok(v);
  assert.equal(v.explanation_burmese.includes("ပြောနေသည်"), false);
  assert.match(v.explanation_burmese, /လိုချင်သည်/);
});


