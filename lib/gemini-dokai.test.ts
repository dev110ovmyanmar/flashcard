import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOKAI_DEFAULT_GEMINI_MODEL,
  DOKAI_MAX_TEXT_CHARS,
  dokaiGeminiModelChain,
  dokaiGeminiModelName,
  dokaiSnapFromGemini,
  normalizeDokaiTextInput,
} from "./gemini-dokai";

describe("normalizeDokaiTextInput", () => {
  it("trims and caps length", () => {
    assert.equal(normalizeDokaiTextInput("  a\r\nb\u0000  "), "a\nb");
    assert.equal(normalizeDokaiTextInput("x".repeat(DOKAI_MAX_TEXT_CHARS + 5)).length, DOKAI_MAX_TEXT_CHARS);
  });
});

describe("dokaiGeminiModelName", () => {
  it("defaults to flash-lite", () => {
    assert.equal(dokaiGeminiModelName(undefined), DOKAI_DEFAULT_GEMINI_MODEL);
    assert.equal(dokaiGeminiModelName("models/gemini-3.5-flash"), "gemini-3.5-flash");
  });
});

describe("dokaiGeminiModelChain", () => {
  it("dedupes preferred model", () => {
    const chain = dokaiGeminiModelChain("gemini-3.5-flash");
    assert.equal(chain[0], "gemini-3.5-flash");
    assert.equal(chain.filter((m) => m === "gemini-3.5-flash").length, 1);
  });
});

describe("dokaiSnapFromGemini", () => {
  it("parses question payload and strips Korean glosses", () => {
    const parsed = dokaiSnapFromGemini({
      passage_text: "近年、企業が在宅勤務を導入している。",
      summary_burmese: "ကုမ္ပဏီများ အိမ်မှအလုပ်လုပ်ခြင်း စတင်သည် — 요약",
      intent_burmese: "အကျိုးနှင့် ကန့်သတ်ချက်ကို ပြရန်။",
      glossary: [
        {
          surface: "在宅勤務",
          reading: "ざいたくきんむ",
          meaning_burmese: "အိမ်မှအလုပ်လုပ်ခြင်း — 요약",
        },
      ],
      questions: [
        {
          question_number: "1",
          question_text: "筆者が言いたいことは何か。",
          correct_option: "2",
          options_table: [
            {
              option: "1",
              japanese: "在宅勤務はすべての仕事に向いている。",
              meaning_burmese: "အလုပ်အားလုံးနှင့် ကိုက်ညီသည်။ — 요약",
              why_wrong_burmese: "စာသားနှင့် ဆန့်ကျင်သည်။",
            },
            {
              option: "2",
              japanese: "向く仕事と向かない仕事がある。",
              meaning_burmese: "ကိုက်ညီ/မကိုက်ညီသော အလုပ်ရှိသည်။",
              why_wrong_burmese: "should clear",
            },
          ],
          explanation_burmese: "၂ သည် အဖြေမှန်။",
        },
      ],
    });
    assert.equal(parsed.payload.passage_text.includes("在宅"), true);
    assert.equal(parsed.payload.summary_burmese.includes("요약"), false);
    assert.equal(parsed.payload.glossary.length, 1);
    assert.equal(parsed.payload.glossary[0]?.meaning_burmese.includes("요약"), false);
    assert.equal(parsed.payload.questions.length, 1);
    const q = parsed.payload.questions[0]!;
    assert.equal(q.correct_option, "2");
    assert.equal(q.options_table[0]?.meaning_burmese.includes("요약"), false);
    assert.equal(q.options_table[1]?.why_wrong_burmese, "");
  });

  it("accepts passage-only payloads", () => {
    const parsed = dokaiSnapFromGemini({
      passage_text: "本文です。",
      summary_burmese: "",
      intent_burmese: "",
      glossary: [],
      questions: [],
    });
    assert.equal(parsed.payload.passage_text, "本文です。");
    assert.equal(parsed.payload.questions.length, 0);
    assert.equal(parsed.payload.glossary.length, 0);
  });
});
