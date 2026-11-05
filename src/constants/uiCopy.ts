/**
 * Shared English UI chrome for nav, analyzers, and cards.
 * Learner content (meanings, explanations) stays Burmese via each analyzer prompt.
 * System language lock: Japanese, English, Myanmar only.
 */
export const UI = {
  nav: {
    decks: "Decks",
    vocab: "Vocab",
    grammar: "Grammar",
    script: "Script",
    dokai: "Dokai",
    aria: "Navigation",
  },
  input: {
    modeAria: "Input mode",
    image: "Image",
    text: "Text",
    dropImage: "Drop an image here",
    upload: "Upload",
    camera: "Camera",
    clear: "Clear",
    analyze: "Analyze",
    analyzing: "Analyzing…",
  },
  results: {
    results: "Results",
    questions: (n: number) => `${n} questions`,
    new: "New",
    readingOverview: "Reading overview",
    passage: "Passage",
    script: "Script",
    translation: "Full translation",
    translationAria: "Full conversation translation",
    summary: "Summary",
    intent: "Author's intent",
    cacheLoaded: "Loaded from cache",
  },
  hints: {
    vocabImage: "PNG, JPG, or WebP · Mondai 1–6",
    vocabImageAlt: "Selected exam page",
    vocabTextTitle: "Paste or type vocabulary text",
    vocabTextHint: "Mondai 1–6 questions and options",
    vocabPlaceholder: "Paste vocabulary exam text…",
    vocabLoading: "Analyzing vocabulary page…",
    grammarImage: "PNG, JPG, or WebP · Grammar / ★",
    grammarImageAlt: "Selected grammar page",
    grammarTextTitle: "Paste or type grammar text",
    grammarTextHint: "Grammar / ★ questions with options",
    grammarPlaceholder: "Paste grammar exam text…",
    grammarLoading: "Analyzing grammar page…",
    dokaiImage: "PNG, JPG, or WebP · Reading / Dokai",
    dokaiImageAlt: "Selected reading page",
    dokaiTextTitle: "Paste passage and questions",
    dokaiTextHint: "Reading passage and questions",
    dokaiPlaceholder: "Paste reading text…",
    dokaiLoading: "Analyzing reading…",
    scriptImage: "PNG, JPG, or WebP · Listening script",
    scriptImageAlt: "Selected script page",
    scriptTextTitle: "Paste or type script text",
    scriptTextHint: "Listening script dialogue / narration",
    scriptPlaceholder: "Paste script text…",
    scriptLoading: "Analyzing script…",
  },
  card: {
    correct: "正解",
    wrong: "誤答",
    number: "#",
    kanji: "Kanji",
    choice: "Choice",
    exampleUse: "Example use",
    meaning: "Meaning",
    usage: "Usage",
    usageContext: "Usage & context",
    example: "Example",
    pattern: "Pattern",
    question: "Question",
    sentence: "Full sentence",
    sentenceAria: "Sentence meaning",
    explanation: "Explanation",
    explanationDetails: "Explanation & Distractors",
    explanationMy: "အသေးစိတ် ရှင်းလင်းချက်",
    nuance: "Nuance",
    nuanceContext: "Nuance & Context",
    wrongOptions: "Wrong options",
    whyWrong: "Why it doesn't fit",
    whyCorrect: "Why this is correct",
    relatedGrammar: "Related grammar",
    inScript: "In the script",
    explanationContext: "Explanation & Context",
  },
  page: {
    vocab: "Vocab",
    grammar: "Grammar",
    script: "Script",
    dokai: "Dokai",
  },
} as const;

/** Shared lock for Gemini system prompts — JA / EN / MY only. */
export const LANGUAGE_LOCK_JA = `# 使用言語（厳守・システム全体）
- 許可する言語は次の3つのみ: 日本語・英語・ビルマ語（ミャンマー語）。これ以外は一切禁止
- 学習者向けの語義・用法・解説・誤答理由・要約・ニュアンス・全文訳はビルマ語（ミャンマー語）のみ
- 見出し語・例文・設問文・キーワードは日本語のみ（必要なら必ず 漢字《ひらがな》）
- 英語は JSONキー名・UIラベル・技術メタのみ。学習者向け解説・語義を英語で書かない
- 禁止する言語・文字: 中国語・韓国語（ハングル）・タイ語・ベトナム語・ヒンディー語／デーヴァナーガリー・ベンガル語・クメール語・ラオス語・ヘブライ語・その他すべて
- 絶対に出してはいけない混入例（実害あり）:
  - 韓国語: 하기로 / 뿐만 아니라 / 예:
  - ベトナム語: liệu / được / không / của
  - ベンガル文字の混入: ဥপমা（正: ဥပမာ）・その他 U+0980–U+09FF
  - タイ語: สัปดาห์ / သัပတ
  - ヒンディー: अग
- ビルマ語フィールドで禁止するメタ見出し: 「နံပါတ် ၁」「နံပါတ် ၂」「အမှတ် ၁」「No. 1」など番号ラベル。本文だけを書く
- 禁止する表記: 拼音、韓国語・タイ語・ベトナム語・ベンガル文字などの括弧注、スラッシュ他言語対訳、学習者向け本文での不要な他言語注
- *_burmese フィールドにハングル・ベンガル文字・タイ文字・デーヴァナーガリー・ベトナム語ラテン（liệu 等）を1文字でも入れない`;
