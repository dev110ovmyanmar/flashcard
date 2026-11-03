import assert from "node:assert/strict";
import { test } from "node:test";
import { scriptGrammarToRows, scriptVocabToRows } from "./script-to-goi";

test("maps script vocabulary into flashcard rows", () => {
  const rows = scriptVocabToRows([
    {
      word: "打ち合わせ",
      reading: "うちあわせ",
      meaning_burmese: "ညှိနှိုင်းအစည်းအဝေး",
      explanation_burmese: "အလုပ်မစမီ ညှိနှိုင်းသော အစည်းအဝေး။",
      example_sentence: "明日の打ち合わせです。",
      jlpt_level: "N2",
    },
    {
      word: "打ち合わせ",
      reading: "うちあわせ",
      meaning_burmese: "ညှိနှိုင်းအစည်းအဝေး",
      explanation_burmese: "အလုပ်မစမီ ညှိနှိုင်းသော အစည်းအဝေး။",
      example_sentence: "重複",
      jlpt_level: "N2",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.kanji, "打ち合わせ");
  assert.equal(rows[0]?.reading, "うちあわせ");
  assert.match(rows[0]?.meaning ?? "", /ညှိ/);
});

test("maps script grammar into flashcard rows", () => {
  const rows = scriptGrammarToRows([
    {
      pattern: "～てしまう《てしまう》",
      reading: "てしまう",
      explanation_burmese: "လုပ်ပြီးဖြစ်သွားသည်။",
      usage_in_script: "忘れてしまった。",
      usage_burmese: "မေ့သွားသည်ဟု ပြောသည်။",
      nuance_burmese: "နောင်တ ခံစားချက် ပါသည်။",
      context_example: "電車に傘を忘れてしまった。",
      jlpt_level: "N4",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.ok(rows[0]?.kanji.includes("てしまう") || rows[0]?.kanji.includes("しまう"));
  assert.match(rows[0]?.meaning ?? "", /လုပ်/);
});
