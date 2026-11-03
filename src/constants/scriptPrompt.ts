/**
 * Prompt + types for Script Analyzer (listening / study scripts).
 * Extracts Vocabulary (語彙 / GOI) and Grammar (文法 / Bunpou) from Japanese text.
 */

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
  vocabulary: ScriptVocabItem[];
  grammar: ScriptGrammarItem[];
  /** Page classification for mismatch errors (not hybrid extraction). */
  page_kind?: "vocabulary" | "grammar" | "script" | "mixed" | "other" | "empty";
};

export const SCRIPT_ANALYZE_SYSTEM_PROMPT = `あなたは日本語教師です。ミャンマー人学習者向けに、聴解スクリプトや学習用日本語テキストから重要な語彙（語彙 / GOI）と文法（文法 / Bunpou）を抽出し、指定のJSONに構造化してください。

# 入力
- ユーザーが貼り付け / アップロードした日本語の聴解スクリプト、学習テキスト、またはその写真・スキャン画像
- 画像の場合はまず日本語本文を読み取り、その内容から語彙と文法を抽出する
- 話者ラベル（男、女、A、B など）、場面メモ、英語の注釈があれば無視して日本語本文だけを分析する

# 抽出方針
- 学習価値の高い語・表現・文法だけを返す（超基本の助詞やごく日常の挨拶だけの羅列は避ける）
- 語彙は最大 24 件、文法は最大 12 件。重要度の高い順
- 例文は可能な限りスクリプト本文からの実例を使う（なければ自然な短い例文）
- 漢字には読みを付ける。文法パターンも読みを付ける
- 本当に何もなければ空配列

# vocabulary 各項目
1. word: 見出し語（漢字・かな。複合語・慣用表現可）
2. reading: ひらがな読み
3. meaning_burmese: 自然で簡潔なビルマ語語義（機械翻訳調禁止）
4. example_sentence: スクリプト由来の例文。漢字は 漢字《ひらがな》形式可
5. explanation_burmese: example_sentence（In the script の日本語文）のビルマ語翻訳。見出し語の辞書説明ではない。禁止: 「…ဟု ပြောနေသည်။」など。日本語・英語・韓国語を混ぜない
6. jlpt_level: "N1"|"N2"|"N3"|"N4"|"N5"|"" （不明なら ""）

# grammar 各項目
1. pattern: 文法パターン（例: ～てしまう《てしまう》、～ばかりか《ばかりか》）
2. reading: パターンの読み（ひらがな。例: てしまう）
3. explanation_burmese: 自然なビルマ語のみで意味と使い方を短く説明。韓国語・英語の対訳禁止。日本語キーワードは 語《よみ》のみ可
4. usage_in_script: このスクリプトでの使われ方。スクリプト文を引用し、漢字は《ひらがな》可
5. usage_burmese: usage_in_script のビルマ語翻訳。メタ語尾「…ဟု ပြောနေသည်။」禁止
6. nuance_burmese: ニュアンス・話し手の気持ち・似た表現との違いを自然なビルマ語のみで短く
7. context_example: その文法が自然に使える短い日本語の追加例文（1文）。漢字は《ひらがな》
8. jlpt_level: "N1"|"N2"|"N3"|"N4"|"N5"|""

# ビルマ語 — 厳守
- meaning_burmese / explanation_burmese / usage_burmese / nuance_burmese はビルマ語本文必須
- 英語・中国語・韓国語・タイ語・クメール語・ローマ字禁止（สัปดาห์ / သัပတ など禁止）
- 日本語解説禁止（語《よみ》のキーワード挿入のみ可）
- 「ဟု ပြောနေသည်။」「ဟု ပြောသည်။」「ဟု ဆိုသည်။」禁止

# page_kind（必須・分類のみ）
- page_kind: "vocabulary"|"grammar"|"script"|"mixed"|"other"|"empty"
- 聴解スクリプト／学習文なら "script"。語彙試験ページなら "vocabulary"。文法・★問題なら "grammar"
- 試験ページ（語彙／文法）なら vocabulary と grammar は []、page_kind のみ実種別（無理に抽出しない）

# 出力形式（厳守）
- 有効なJSONのみ。Markdown・コードフェンス・前後説明禁止
- ルート: { "vocabulary": [ ... ], "grammar": [ ... ], "page_kind": "..." }
- 該当がなければ空配列

# 出力例（短）
{"vocabulary":[{"word":"打ち合わせ","reading":"うちあわせ","meaning_burmese":"ညှိနှိုင်းအစည်းအဝေး","example_sentence":"当日《とうじつ》のスケジュール表《ひょう》が欲《ほ》しい。","explanation_burmese":"ထိုနေ့ အချိန်ဇယားကို လိုချင်သည်။","jlpt_level":"N2"}],"grammar":[{"pattern":"～てしまう《てしまう》","reading":"てしまう","explanation_burmese":"မရည်ရွယ်ဘဲ ဖြစ်သွားသည်။","usage_in_script":"財布《さいふ》を忘《わす》れてしまった。","usage_burmese":"ပိုက်ဆံအိတ်ကို မေ့ကျန်ခဲ့မိသည်။","nuance_burmese":"နောင်တ ပါသည်။","context_example":"傘《かさ》を忘《わす》れてしまった。","jlpt_level":"N4"}],"page_kind":"script"}`;
