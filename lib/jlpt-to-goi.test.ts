import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanHeadword,
  cleanReading,
  isValidVocabEntry,
  jlptQuestionsToVocabRows,
  primaryMeaning,
} from "./jlpt-to-goi";
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
  meaning_burmese: "မအောင်မြင်ခြင်း",
  correct_option: "3",
  options_table: [
    {
      option: "1",
      japanese: "成功",
      reading: "せいこう",
      meaning_burmese: "အောင်မြင်ခြင်း",
      usage_burmese: "အစီအစဉ် အောင်မြင်သည်ဟု ပြောသည့်အခါ",
      example_sentence: "計画《けいかく》が成功《せいこう》した。",
      example_burmese: "အစီအစဉ် အောင်မြင်ခဲ့သည်။",
      sentence_burmese: "",
      why_wrong_burmese: "ဆန့်ကျင်ဘက်ဖြစ်သည်",
    },
    {
      option: "2",
      japanese: "完成",
      reading: "かんせい",
      meaning_burmese: "ပြီးဆုံးခြင်း",
      usage_burmese: "အလုပ် ပြီးသည်ဟု ပြောသည့်အခါ",
      example_sentence: "工事《こうじ》が完成《かんせい》した。",
      example_burmese: "အလုပ် ပြီးဆုံးခဲ့သည်။",
      sentence_burmese: "",
      why_wrong_burmese: "မအောင်မြင်ခြင်းကို မဆိုလို",
    },
    {
      option: "3",
      japanese: "失敗",
      reading: "しっぱい",
      meaning_burmese: "မအောင်မြင်ခြင်း",
      usage_burmese: "အစီအစဉ် မအောင်မြင်ဟု ပြောသည့်အခါ",
      example_sentence: "計画《けいかく》は失敗《しっぱい》に終《お》わった。",
      example_burmese: "အစီအစဉ် မအောင်မြင်ဘဲ ပြီးသွားသည်။",
      sentence_burmese: "",
      why_wrong_burmese: "",
    },
    {
      option: "4",
      japanese: "継続",
      reading: "けいぞく",
      meaning_burmese: "ဆက်လက်လုပ်ခြင်း",
      usage_burmese: "ဆက်လုပ်သည်ဟု ပြောသည့်အခါ",
      example_sentence: "作業《さぎょう》を継続《けいぞく》する。",
      example_burmese: "အလုပ်ကို ဆက်လုပ်သည်။",
      sentence_burmese: "",
      why_wrong_burmese: "အဆုံးသတ်ခြင်းနှင့် မကိုက်",
    },
  ],
  explanation_burmese: "ရှည်လျားသော ရှင်းလင်းချက် မပါသင့်",
  nuance_note: "nuance မပါသင့်",
};

test("maps every JLPT option into short Goi vocab rows", () => {
  const rows = jlptQuestionsToVocabRows([SAMPLE]);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => row.kanji),
    ["成功", "完成", "失敗", "継続"],
  );
  assert.equal(rows[2]?.reading, "しっぱい");
  assert.equal(rows[2]?.meaning, "မအောင်မြင်ခြင်း");
  assert.equal(rows[0]?.meaning, "အောင်မြင်ခြင်း");

  for (const row of rows) {
    assert.doesNotMatch(row.meaning, /အစီအစဉ်|မှားသော|အဖြေမှန်|ရှင်းလင်းချက်|nuance/);
  }
});

test("skips fallback target_word when there is no short Burmese gloss", () => {
  const rows = jlptQuestionsToVocabRows([
    {
      ...SAMPLE,
      options_table: [],
      explanation_burmese: "ရှင်းလင်းချက်",
      nuance_note: "nuance",
    },
  ]);
  assert.equal(rows.length, 0);
});

test("keeps only the first / most practical Burmese sense", () => {
  assert.equal(primaryMeaning("လက်တွေ့ကျသော၊ ဖြစ်နိုင်သော။"), "လက်တွေ့ကျသော");
  assert.equal(
    primaryMeaning("တက်ကြွသော၊ ရှေ့တိုးသော၊ အပြုသဘောဆောင်သော။"),
    "တက်ကြွသော",
  );
  assert.equal(primaryMeaning("ဝယ်သည်"), "ဝယ်သည်");
  assert.equal(primaryMeaning("buy / purchase"), "");
  assert.equal(primaryMeaning("現実的《げんじつてき》 လက်တွေ့ကျသော"), "လက်တွေ့ကျသော");
  assert.equal(primaryMeaning("ကြေညာစာကပ်ခြင်း"), "ကြေညာစာကပ်ခြင်း");
  assert.equal(primaryMeaning("掲示"), "");
});

test("rejects or peels full-sentence stem translations from meaning_burmese", () => {
  assert.equal(
    primaryMeaning("သူ၏စကားသည် အလွန်လက်တွေ့မကျသောကြောင့် မည်သူမျှမယုံခဲ့ပါ။"),
    "",
  );
  assert.equal(primaryMeaning("ဖြည့်စွက်ခြင်းသည်။"), "ဖြည့်စွက်ခြင်း");
  assert.equal(primaryMeaning("မအောင်မြင်ခြင်း"), "မအောင်မြင်ခြင်း");
});

test("rejects invalid headwords, readings, and empty glosses", () => {
  assert.equal(cleanHeadword("_____"), "");
  assert.equal(cleanHeadword("???"), "");
  assert.equal(cleanHeadword("安心"), "安心");
  assert.equal(cleanReading("あんしん", "安心"), "あんしん");
  assert.equal(cleanReading("anshin", "安心"), "");
  assert.equal(cleanReading("အာန်ရှင်", "安心"), "");
  assert.equal(isValidVocabEntry("安心", "あんしん", "စိတ်ချရခြင်း"), true);
  assert.equal(isValidVocabEntry("安心", "", "စိတ်ချရခြင်း"), false);
  assert.equal(isValidVocabEntry("安心", "あんしん", ""), false);
  assert.equal(isValidVocabEntry("_____", "あ", "စမ်း"), false);
});

test("drops garbled or incomplete options when saving", () => {
  const rows = jlptQuestionsToVocabRows([
    {
      ...SAMPLE,
      options_table: [
        {
          option: "1",
          japanese: "安心",
          reading: "あんしん",
          meaning_burmese: "စိတ်ချရခြင်း၊ ငြိမ်းချမ်းခြင်း၊ သက်သာခြင်း။",
          usage_burmese: "long note",
          example_sentence: "",
          example_burmese: "",
          sentence_burmese: "",
          why_wrong_burmese: "",
        },
        {
          option: "2",
          japanese: "_____",
          reading: "あ",
          meaning_burmese: "အလွတ်",
          usage_burmese: "",
          example_sentence: "",
          example_burmese: "",
          sentence_burmese: "",
          why_wrong_burmese: "",
        },
        {
          option: "3",
          japanese: "失敗",
          reading: "shippai",
          meaning_burmese: "မအောင်မြင်ခြင်း",
          usage_burmese: "",
          example_sentence: "",
          example_burmese: "",
          sentence_burmese: "",
          why_wrong_burmese: "",
        },
        {
          option: "4",
          japanese: "成功",
          reading: "せいこう",
          meaning_burmese: "",
          usage_burmese: "အစီအစဉ် အောင်မြင်သည်",
          example_sentence: "",
          example_burmese: "",
          sentence_burmese: "",
          why_wrong_burmese: "",
        },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.kanji, "安心");
  assert.equal(rows[0]?.reading, "あんしん");
  assert.equal(rows[0]?.meaning, "စိတ်ချရခြင်း");
});
