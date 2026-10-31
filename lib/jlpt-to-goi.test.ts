import assert from "node:assert/strict";
import { test } from "node:test";
import { jlptQuestionsToVocabRows } from "./jlpt-to-goi";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

const SAMPLE: JlptQuestion = {
  mondai_type: 4,
  question_number: 1,
  japanese_sentence: "その計画は_____に終わった。",
  furigana_tokens: [
    { surface: "その", reading: "" },
    { surface: "計画", reading: "けいかく" },
    { surface: "は_____に", reading: "" },
    { surface: "終", reading: "お" },
    { surface: "わった。", reading: "" },
  ],
  target_word: "失敗",
  reading: "しっぱい",
  correct_option: "3",
  options_table: [
    {
      option: "1",
      japanese: "成功",
      reading: "せいこう",
      meaning_burmese: "အောင်မြင်ခြင်း",
      usage_burmese: "အစီအစဉ် အောင်မြင်သည်ဟု ပြောသည့်အခါ",
      why_wrong_burmese: "ဆန့်ကျင်ဘက်ဖြစ်သည်",
    },
    {
      option: "2",
      japanese: "完成",
      reading: "かんせい",
      meaning_burmese: "ပြီးဆုံးခြင်း",
      usage_burmese: "အလုပ် ပြီးသည်ဟု ပြောသည့်အခါ",
      why_wrong_burmese: "မအောင်မြင်ခြင်းကို မဆိုလို",
    },
    {
      option: "3",
      japanese: "失敗",
      reading: "しっぱい",
      meaning_burmese: "မအောင်မြင်ခြင်း",
      usage_burmese: "အစီအစဉ် မအောင်မြင်ဟု ပြောသည့်အခါ",
      why_wrong_burmese: "",
    },
    {
      option: "4",
      japanese: "継続",
      reading: "けいぞく",
      meaning_burmese: "ဆက်လက်လုပ်ခြင်း",
      usage_burmese: "ဆက်လုပ်သည်ဟု ပြောသည့်အခါ",
      why_wrong_burmese: "အဆုံးသတ်ခြင်းနှင့် မကိုက်",
    },
  ],
  explanation_burmese: "",
  nuance_note: "",
};

test("maps every JLPT option into Goi vocab rows", () => {
  const rows = jlptQuestionsToVocabRows([SAMPLE]);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.kanji),
    ["成功", "完成", "失敗", "継続"],
  );
  assert.equal(rows[2]?.reading, "しっぱい");
  assert.match(rows[2]?.meaning ?? "", /正解/);
  assert.match(rows[0]?.meaning ?? "", /誤:/);
});

test("falls back to target_word when options are empty", () => {
  const rows = jlptQuestionsToVocabRows([
    {
      ...SAMPLE,
      options_table: [],
      explanation_burmese: "ရှင်းလင်းချက်",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.kanji, "失敗");
  assert.equal(rows[0]?.reading, "しっぱい");
});
