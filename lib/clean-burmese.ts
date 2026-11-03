/**
 * Sanitize model output meant to be Myanmar (Burmese) only.
 * Models sometimes inject Thai (e.g. สัปดาห์ / mixed သัပတ), Korean, Hebrew, Khmer, or English glosses.
 */

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
 * Remove non-Burmese gloss leftovers from Burmese fields.
 * Thai tokens (incl. mixed သัပတ) are removed as whole words.
 * Lookalike ဥပမာ garbles (Latin p / Hebrew pe) are normalized first.
 */
export function stripForeignGlosses(text: string): string {
  if (!text) return "";
  return stripMetaSpeechEnding(
    text
      // ဥပမာ with Latin p or Hebrew pe (פ) instead of Myanmar ပ
      .replace(/ဥ[pPפ]မာ/gu, "ဥပမာ")
      // Any token containing Thai script (U+0E00–U+0E7F), e.g. สัปดาห์ or mixed သัပတ
      .replace(/[^\s/|·•—–.,;:。、()（）]*[\u0E00-\u0E7F][^\s/|·•—–.,;:。、()（）]*/gu, "")
      // Hangul syllables + compatibility jamo (e.g. 뿐만 아니라)
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]+(?:\s*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]+)*/g, "")
      // Hebrew (remaining runs after ဥပမာ normalize)
      .replace(/[\u0590-\u05FF]+/g, "")
      // Khmer
      .replace(/[\u1780-\u17FF\u19E0-\u19FF]+/g, "")
      // Lao
      .replace(/[\u0E80-\u0EFF]+/g, "")
      // Parenthetical Latin glosses: (not only… but also)
      .replace(/\(\s*[A-Za-z][^)]*\)/g, "")
      .replace(/(^|[\s/|·•—–-])(?:not\s+only[^/|·•—–-]{0,40}but\s+also|as\s+well\s+as)(?=$|[\s/|·•—–.,;:。、])/gi, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s*([/|·•])\s*/g, " $1 ")
      .replace(/(?:\s*[/|·•]\s*){2,}/g, " ")
      .replace(/^\s*[/|·•—–-]+\s*|\s*[/|·•—–-]+\s*$/g, "")
      .trim(),
  );
}

/** Clean a Burmese prose field from Gemini (null-safe). */
export function cleanBurmeseField(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripForeignGlosses(value);
}
