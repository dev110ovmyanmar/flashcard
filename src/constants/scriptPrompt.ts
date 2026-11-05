/**
 * Prompt + types for Script Analyzer (listening / study scripts).
 * Extracts Vocabulary (語彙 / GOI) and Grammar (文法 / Bunpou) from Japanese text.
 */

import { LANGUAGE_LOCK_JA } from "@/src/constants/uiCopy";

export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5" | "";

export type ScriptVocabItem = {
  /** Surface form as it appears (kanji and/or kana). */
  word: string;
  /** Hiragana reading. */
  reading: string;
  /** Natural Burmese (Myanmar) gloss for learners. */
  meaning_burmese: string;
  /**
   * Burmese translation of `example_sentence` (the “In the script” line).
   * Not a headword gloss; not meta “ဟု ပြောနေသည်”.
   */
  explanation_burmese: string;
  /** Example sentence taken from the script when possible. */
  example_sentence: string;
  /** Estimated JLPT level, e.g. N2. Empty if unknown. */
  jlpt_level: JlptLevel;
};

export type ScriptGrammarItem = {
  /** Grammar pattern with reading markup when useful, e.g. ～にもかかわらず《にもかかわらず》. */
  pattern: string;
  /** Hiragana reading for the pattern (plain, no markup). */
  reading: string;
  /** Natural Burmese explanation of the grammar. */
  explanation_burmese: string;
  /** How it is used in this script — quote or paraphrase the script sentence. */
  usage_in_script: string;
  /** Burmese explanation of that script usage / context. */
  usage_burmese: string;
  /** Nuance / tone / compare-with notes in Burmese (like Vocabulary Analyzer nuance). */
  nuance_burmese: string;
  /** Extra Japanese context example sentence (漢字《ひらがな》), separate from the script quote. */
  context_example: string;
  /** Estimated JLPT level. Empty if unknown. */
  jlpt_level: JlptLevel;
};

export type ScriptAnalyzePayload = {
  /** Full Japanese script / dialogue as read from the image or paste. */
  script_text: string;
  /** Full natural Burmese translation of the entire conversation / narration. */
  translation_burmese: string;
  vocabulary: ScriptVocabItem[];
  grammar: ScriptGrammarItem[];
  /** Page classification for mismatch errors (not hybrid extraction). */
  page_kind?: "vocabulary" | "grammar" | "script" | "mixed" | "other" | "empty";
};

export const SCRIPT_ANALYZE_SYSTEM_PROMPT = `あなたは日本語教師です。ミャンマー人学習者向けに、聴解スクリプトや学習用日本語テキストから語彙（語彙 / GOI）と文法（文法 / Bunpou）を **すべて** 抽出し、指定のJSONに構造化してください。

${LANGUAGE_LOCK_JA}

# 入力
- ユーザーが貼り付け / アップロードした日本語の聴解スクリプト、学習テキスト、またはその写真・スキャン画像
- 画像の場合はまず日本語本文を読み取り、その内容から語彙と文法を抽出する
- 話者ラベル（男、女、A、B など）は会話の一部として script_text に残す。場面メモ・英語など第三言語の注釈は無視

# 本文と全文翻訳（必須）
1. script_text: スクリプト／会話の日本語本文全体。話者ラベル付きで改行を保つ。漢字は可能なら 漢字《ひらがな》。途中で切らない
2. translation_burmese: 会話／ナレーション全体の自然なビルマ語翻訳（話者ごと・流れどおり）。要約ではなく全文。機械翻訳調禁止

# 抽出方針（網羅が最優先）
- スクリプト本文に出てくる語彙と文法を **すべて** 返す。重要そうな一部だけに絞らない。レベルで除外しない（N5〜N1 すべて対象）
- 語彙: 名詞・動詞・い形容詞・な形容詞・副詞・接続詞・複合語・慣用表現・学習用フレーズをすべて拾う
- 文法: スクリプトに現れる文法パターン・文型・助動詞・接続表現をすべて拾う
- 除外してよいもののみ: 単独の超基本助詞だけ（は／が／を／に／で／と／も／へ／から／まで／より／や／の）、話者ラベル、固有名詞の羅列だけ
- 「こんにちは」「ありがとう」など挨拶もスクリプトにあれば1件として含めてよい
- 語彙は最大 120 件、文法は最大 60 件。件数を減らすために省略しない。上限に達したら学習価値の高い順
- 同じ見出し語・同じ文法パターンの重複は1件にまとめる（活用形は基本形にまとめてよい）
- 例文は可能な限りスクリプト本文からの実例を使う（なければ自然な短い例文）
- 漢字には読みを付ける。文法パターンも読みを付ける
- jlpt_level は推定で "N1"|"N2"|"N3"|"N4"|"N5"|""（不明なら ""）。レベルはラベルのみで、抽出の可否には使わない
- 本当に何もなければ空配列

# vocabulary 各項目
1. word: 見出し語（漢字・かな。複合語・慣用表現可）
2. reading: ひらがな読み
3. meaning_burmese: 自然で簡潔なビルマ語語義（機械翻訳調禁止）
4. example_sentence: スクリプト由来の例文。漢字は 漢字《ひらがな》形式可
5. explanation_burmese: example_sentence（脚本中の日本語文）のビルマ語翻訳。見出し語の辞書説明ではない。禁止: 「…ဟု ပြောနေသည်။」など
6. jlpt_level: "N1"|"N2"|"N3"|"N4"|"N5"|"" （不明なら ""）

# grammar 各項目
1. pattern: 文法パターン（例: ～ばかりか《ばかりか》、～ことになっている《ことになっている》、～てしまう《てしまう》）
2. reading: パターンの読み（ひらがな。例: ばかりか）
3. explanation_burmese: 自然なビルマ語のみで意味と使い方を短く説明。日本語キーワードは 語《よみ》のみ可
4. usage_in_script: このスクリプトでの使われ方。スクリプト文を引用し、漢字は《ひらがな》可
5. usage_burmese: usage_in_script のビルマ語翻訳。メタ語尾「…ဟု ပြောနေသည်။」禁止
6. nuance_burmese: ニュアンス・話し手の気持ち・似た表現との違いを自然なビルマ語のみで短く
7. context_example: その文法が自然に使える短い日本語の追加例文（1文）。漢字は《ひらがな》
8. jlpt_level: "N1"|"N2"|"N3"|"N4"|"N5"|"" （不明なら ""）

# ビルマ語 — 厳守
- translation_burmese / meaning_burmese / explanation_burmese / usage_burmese / nuance_burmese はビルマ語本文必須
- 日本語解説禁止（語《よみ》のキーワード挿入のみ可）
- 「ဟု ပြောနေသည်။」「ဟု ပြောသည်။」「ဟု ဆိုသည်။」禁止（translation_burmese の会話文としても使わない）
- 「နံပါတ် ၁」「အမှတ် ၂」など番号メタ見出し禁止。会話本文だけを書く
- ベトナム語（liệu / được 等）・他言語の混入禁止

# page_kind（必須・分類のみ）
- page_kind: "vocabulary"|"grammar"|"script"|"mixed"|"other"|"empty"
- 聴解スクリプト／学習文なら "script"。語彙試験ページなら "vocabulary"。文法・★問題なら "grammar"
- 試験ページ（語彙／文法）なら vocabulary と grammar は []、script_text / translation_burmese も ""、page_kind のみ実種別（無理に抽出しない）

# 出力形式（厳守）
- 有効なJSONのみ。Markdown・コードフェンス・前後説明禁止
- ルート: { "script_text": "...", "translation_burmese": "...", "vocabulary": [ ... ], "grammar": [ ... ], "page_kind": "..." }
- 該当がなければ空配列／空文字列

# 出力例（短）
{"script_text":"男：すみません、駅《えき》までの行《い》き方《かた》を教《おし》えていただけますか。\\n女：はい。この道《みち》をまっすぐ行《い》って、二《ふた》つ目《め》の信号《しんごう》を右《みぎ》に曲《ま》がってください。","translation_burmese":"ယောက်ျား: တောင်းပန်ပါ၏၊ ဘူတာအထိ သွားနည်းကို ပြောပြပေးနိုင်ပါသလား။\\nမိန်းမ: ဟုတ်ကဲ့။ ဒီလမ်းကို တည့်တည့်သွားပြီး ဒုတိယ မီးပွိုင့်မှာ ညာဘက်ကွေ့ပါ။","vocabulary":[{"word":"打ち合わせ","reading":"うちあわせ","meaning_burmese":"ညှိနှိုင်းအစည်းအဝေး","example_sentence":"当日《とうじつ》のスケジュール表《ひょう》が欲《ほ》しい。","explanation_burmese":"ထိုနေ့ အချိန်ဇယားကို လိုချင်သည်။","jlpt_level":"N2"},{"word":"順調","reading":"じゅんちょう","meaning_burmese":"ချောမွေ့စွာ တိုးတက်နေသည်","example_sentence":"工事《こうじ》は順調《じゅんちょう》に進《すす》んでいます。","explanation_burmese":"အလုပ်များ ချောမွေ့စွာ တိုးတက်နေသည်။","jlpt_level":"N3"},{"word":"都合","reading":"つごう","meaning_burmese":"အဆင်ပြေမှု / အခြေအနေ","example_sentence":"都合《つごう》が悪《わる》いです。","explanation_burmese":"အဆင်မပြေပါ။","jlpt_level":"N4"}],"grammar":[{"pattern":"～ばかりか《ばかりか》","reading":"ばかりか","explanation_burmese":"…သာမက။ ထို့အပြင်။","usage_in_script":"忙しいばかりか、疲れている。","usage_burmese":"အလုပ်များသည်သာမက ပင်ပန်းလည်းသည်။","nuance_burmese":"အလေးပေးပြောသည်။","context_example":"高いばかりか、品質《ひんしつ》も悪《わる》い。","jlpt_level":"N2"},{"pattern":"～ことになっている《ことになっている》","reading":"ことになっている","explanation_burmese":"စည်းကမ်း/အစီအစဉ်အရ …ဖြစ်ရမည်။","usage_in_script":"ここで靴《くつ》を脱《ぬ》ぐことになっています。","usage_burmese":"ဤနေရာတွင် ဖိနပ်ချွတ်ရမည်ဟု သတ်မှတ်ထားသည်။","nuance_burmese":"ကိုယ်ပိုင်ဆုံးဖြတ်ချက်မဟုတ်။","context_example":"会議《かいぎ》は毎週《まいしゅう》月曜《げつよう》に行《おこな》うことになっている。","jlpt_level":"N3"},{"pattern":"～てしまう《てしまう》","reading":"てしまう","explanation_burmese":"မရည်ရွယ်ဘဲ ဖြစ်သွားသည်။","usage_in_script":"財布《さいふ》を忘《わす》れてしまった。","usage_burmese":"ပိုက်ဆံအိတ်ကို မေ့ကျန်ခဲ့မိသည်။","nuance_burmese":"နောင်တ ပါသည်။","context_example":"傘《かさ》を忘《わす》れてしまった。","jlpt_level":"N4"}],"page_kind":"script"}`;
