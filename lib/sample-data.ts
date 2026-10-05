import type { Deck, ParsedRow } from "@/lib/types";

export const SAMPLE_DECK_ID = "deck_sample_n2";

export const SAMPLE_VOCAB: ParsedRow[] = [
  { kanji: "経験", reading: "けいけん", meaning: "အတွေ့အကြုံ" },
  { kanji: "経済", reading: "けいざい", meaning: "စီးပွားရေး" },
  { kanji: "政治", reading: "せいじ", meaning: "နိုင်ငံရေး" },
  { kanji: "環境", reading: "かんきょう", meaning: "ပတ်ဝန်းကျင်" },
  { kanji: "影響", reading: "えいきょう", meaning: "သက်ရောက်မှု" },
  { kanji: "関係", reading: "かんけい", meaning: "ဆက်စပ်မှု" },
  { kanji: "意見", reading: "いけん", meaning: "ထင်မြင်ချက်" },
  { kanji: "理由", reading: "りゆう", meaning: "အကြောင်းရင်း" },
  { kanji: "目的", reading: "もくてき", meaning: "ရည်ရွယ်ချက်" },
  { kanji: "結果", reading: "けっか", meaning: "ရလဒ်" },
  { kanji: "準備", reading: "じゅんび", meaning: "ပြင်ဆင်မှု" },
  { kanji: "参加", reading: "さんか", meaning: "ပါဝင်ခြင်း" },
  { kanji: "説明", reading: "せつめい", meaning: "ရှင်းလင်းချက်" },
  { kanji: "成功", reading: "せいこう", meaning: "အောင်မြင်မှု" },
  { kanji: "失敗", reading: "しっぱい", meaning: "ကျရှုံးမှု" },
  { kanji: "責任", reading: "せきにん", meaning: "တာဝန်" },
  { kanji: "申し込む", reading: "もうしこむ", meaning: "လျှောက်ထားသည်" },
  { kanji: "調べる", reading: "しらべる", meaning: "စုံစမ်းသည်" },
];

/** A textbook-shaped page used when the Gemini API is not configured. */
export const MOCK_TEXTBOOK_PAGE = [
  "N2 語彙",
  "単語　読み　意味",
  "1 経験　けいけん　အတွေ့အကြုံ",
  "2 経済（けいざい）စီးပွားရေး",
  "3 政治 せいじ နိုင်ငံရေး",
  "4 環境",
  "かんきょう",
  "ပတ်ဝန်းကျင်",
  "5 影響　えいきょう　သက်ရောက်မှု",
  "6 比べる　くらべる　နှိုင်းယှဉ်သည်",
  "7 重要　じゅうよう　အရေးကြီးသော",
  "8 可能　かのう　ဖြစ်နိုင်သော",
].join("\n");

export function createSampleDeck(now = Date.now()): Deck {
  return {
    id: SAMPLE_DECK_ID,
    name: "N2 core",
    createdAt: now,
    updatedAt: now,
    source: "sample",
    cards: SAMPLE_VOCAB.map((row, index) => ({
      id: `card_sample_${String(index + 1).padStart(2, "0")}`,
      kanji: row.kanji,
      reading: row.reading,
      meaning: row.meaning,
      ease: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: now,
      lapses: 0,
      reviews: 0,
    })),
  };
}
