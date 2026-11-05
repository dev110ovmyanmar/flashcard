/**
 * Sanitize model output meant to be Myanmar (Burmese) only.
 * Models sometimes inject Thai (e.g. สัปดาห์ / mixed သัပတ), Korean Hangul (e.g. 하기로),
 * Bengali lookalikes (e.g. ဥপমা for ဥပမာ), Devanagari/Hindi (e.g. अग),
 * Vietnamese Latin (e.g. liệu), Hebrew, Khmer, or English glosses,
 * meta list labels (e.g. နံပါတ် ၁), and invent broken Myanmar orthography
 * (e.g. င်္ဟောင်ဆောင်နေသည် → ဟန်ဆောင်နေသည်).
 */

/** Myanmar consonant (for virama / kinzi checks). */
const MY_CONSONANT = "[\u1000-\u102A\u103F\u104E]";

/** Precomposed Vietnamese letters (and đ) that should never appear in Burmese fields. */
const VIETNAMESE_LATIN =
  "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ" +
  "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ";

/** Drop repetitive “…ဟု ပြောနေသည်” meta endings; keep the sentence content. */
export function stripMetaSpeechEnding(text: string): string {
  if (!text) return "";
  const cleaned = text
    .replace(
      /ဟု\s*(?:ပြောနေသည်|ပြောသည်|ဆိုသည်|ပြောထားသည်|ပြောနေကြသည်|ပြောကြသည်)\s*[။.]?\s*$/u,
      "။",
    )
    .replace(/\s*။\s*$/u, "။")
    .trim();
  if (!cleaned || cleaned === "။") return text.trim();
  return cleaned;
}

/**
 * Drop study-note list labels the model invents (“နံပါတ် ၁”, “အမှတ် ၂.”, “No. 1”).
 * Keeps the following prose.
 */
export function stripMetaNumberLabels(text: string): string {
  if (!text) return "";
  return text
    .replace(
      /(^|[\n\r]|[ \t]+)(?:နံပါတ်|အမှတ်)\s*[၀-၉0-9]+(?:\s*[။.:)\]\-–—])?\s*/gu,
      "$1",
    )
    .replace(/(^|[\n\r]|[ \t]+)(?:No\.?|Number|Item)\s*[0-9]+(?:\s*[.):\-–—])?\s*/gi, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Repair common LLM Myanmar orthography failures.
 * - Word-initial kinzi `င်္` is almost always garbage in study-note prose
 *   (real kinzi words start with another consonant: သင်္ချာ, မင်္ဂလာ, အင်္ဂလိပ်).
 * - `ဟောင်ဆောင်` is a frequent corruption of real `ဟန်ဆောင်` (pretend / put on).
 * - Orphan virama (္ not followed by a consonant) is removed.
 */
export function repairBrokenMyanmar(text: string): string {
  if (!text) return "";
  return (
    text
      // Strip word-initial kinzi (င်္…) — keep the base consonant that follows.
      // င်္ဟောင်ဆောင်နေသည် → ဟောင်ဆောင်နေသည်
      .replace(new RegExp(`(^|[\\s/|·•—–.,;:။。、()（）])င်္(?=${MY_CONSONANT})`, "gu"), "$1")
      // Common corruption: ဟောင်ဆောင် → ဟန်ဆောင်
      .replace(/ဟောင်ဆောင်/gu, "ဟန်ဆောင်")
      // Orphan virama (not stacking onto a following consonant)
      .replace(new RegExp(`\\u1039(?!${MY_CONSONANT})`, "gu"), "")
      // Lone asat / virama crumbs at token edges
      .replace(/(^|[\s/|·•—–.,;:။])[\u1039\u103A]+(?=[\s/|·•—–.,;:။]|$)/gu, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

/**
 * Remove non-Burmese gloss leftovers from Burmese fields.
 * Thai tokens (incl. mixed သัပတ) are removed as whole words.
 * Lookalike ဥပမာ garbles (Latin p / Hebrew pe / Bengali প) are normalized first.
 */
export function stripForeignGlosses(text: string): string {
  if (!text) return "";
  return stripMetaSpeechEnding(
    repairBrokenMyanmar(
      stripMetaNumberLabels(
        text
          // ဥပမာ garbles: Latin p, Hebrew pe, Bengali প/মা (e.g. ဥপমা, ဥপမာ)
          .replace(/ဥ(?:[pPפ]|[\u0980-\u09FF]+)(?:မာ|[\u09AE\u09BE]+)?/gu, "ဥပမာ")
          // Any token containing Thai script (U+0E00–U+0E7F), e.g. สัปดาห์ or mixed သัပတ
          .replace(/[^\s/|·•—–.,;:。、()（）]*[\u0E00-\u0E7F][^\s/|·•—–.,;:。、()（）]*/gu, "")
          // Hangul (하기로, 뿐만 아니라, …) — jamo + syllables + extended
          .replace(
            /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]+(?:\s*[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]+)*/g,
            "",
          )
          // Devanagari / Hindi (e.g. अग) — whole tokens that contain any Devanagari letter
          .replace(/[^\s/|·•—–.,;:。、()（）]*[\u0900-\u097F][^\s/|·•—–.,;:。、()（）]*/gu, "")
          .replace(/[\u0900-\u097F]+/gu, "")
          // Bengali / Assamese leftovers (after ဥပမာ normalize)
          .replace(/[^\s/|·•—–.,;:。、()（）]*[\u0980-\u09FF][^\s/|·•—–.,;:。、()（）]*/gu, "")
          .replace(/[\u0980-\u09FF]+/gu, "")
          // Hebrew (remaining runs after ဥပမာ normalize)
          .replace(/[\u0590-\u05FF]+/g, "")
          // Khmer
          .replace(/[\u1780-\u17FF\u19E0-\u19FF]+/g, "")
          // Lao
          .replace(/[\u0E80-\u0EFF]+/g, "")
          // Vietnamese Latin tokens (e.g. liệu, được) — whole words with Việt diacritics
          .replace(new RegExp(`[A-Za-z${VIETNAMESE_LATIN}]*[${VIETNAMESE_LATIN}][A-Za-z${VIETNAMESE_LATIN}]*`, "gu"), "")
          // Cyrillic leftovers
          .replace(/[\u0400-\u04FF]+/g, "")
          // Parenthetical Latin glosses: (not only… but also)
          .replace(/\(\s*[A-Za-z][^)]*\)/g, "")
          .replace(/(^|[\s/|·•—–-])(?:not\s+only[^/|·•—–-]{0,40}but\s+also|as\s+well\s+as)(?=$|[\s/|·•—–.,;:。、])/gi, "$1")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\s*([/|·•])\s*/g, " $1 ")
          .replace(/(?:\s*[/|·•]\s*){2,}/g, " ")
          .replace(/^\s*[/|·•—–-]+\s*|\s*[/|·•—–-]+\s*$/g, "")
          .trim(),
      ),
    ),
  );
}

/** Clean a Burmese prose field from Gemini (null-safe). */
export function cleanBurmeseField(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripForeignGlosses(value);
}
