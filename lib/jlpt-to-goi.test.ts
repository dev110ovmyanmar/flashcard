import assert from "node:assert/strict";
import { test } from "node:test";
import { jlptQuestionsToVocabRows } from "./jlpt-to-goi";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

const SAMPLE: JlptQuestion = {
  mondai_type: 4,
  question_number: 1,
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
  explanation_burmese: "",
  nuance_note: "",
};

test("maps the correct JLPT option into a Goi vocab row", () => {
  const rows = jlptQuestionsToVocabRows([SAMPLE]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.kanji, "失敗");
  assert.equal(rows[0]?.reading, "しっぱい");
  assert.equal(rows[0]?.meaning, "မအောင်မြင်ခြင်း");
});
