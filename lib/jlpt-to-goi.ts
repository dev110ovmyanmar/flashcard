import { uid } from "@/lib/id";
import { hasKanji } from "@/lib/furigana";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";
import type { VocabRow } from "@/lib/types";

/** Japanese letters (kanji / kana / common connectors). */
const JP_CHAR_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶー〜～]/;
/** Valid furigana/reading: kana only. */
const KANA_READING_RE = /^[\u3040-\u309f\u30a0-\u30ffー゛゜・\s]+$/;
/** Myanmar (Burmese) letters. */
const MYANMAR_RE = /[\u1000-\u109f\ua9e0-\ua9ff\uaa60-\uaa7f]/;
/** Blank / placeholder surfaces that are not real vocabulary. */
const PLACEHOLDER_RE = /_{2,}|\uFF3F+|_____|…{2,}|\.{3,}/;
const MEANING_MAX = 48;

/**
 * Turn analyzed JLPT questions into Goi flashcard rows.
 * Saves every valid option (正解 + distractors) as a short card:
 * clean Japanese + kana reading + one primary Burmese meaning.
 * Usage / nuance / why-wrong stay in the analyzer UI only.
 */
export function jlptQuestionsToVocabRows(questions: JlptQuestion[]): VocabRow[] {
  const rows: VocabRow[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const correctKey = question.correct_option.trim();

    if (question.options_table.length > 0) {
      for (const option of question.options_table) {
        const isCorrect = option.option.trim() !== "" && option.option.trim() === correctKey;
        const kanji = cleanHeadword(option.japanese);
        const reading = cleanReading(
          option.reading || (isCorrect ? question.reading : ""),
          kanji,
        );
        const meaning = primaryMeaning(option.meaning_burmese);
        pushRow(rows, seen, { kanji, reading, meaning });
      }
      continue;
    }

    // Fallback when options were not parsed: save the target word alone.
    const kanji = cleanHeadword(question.target_word);
    const reading = cleanReading(question.reading, kanji);
    // No dedicated short gloss on the question — skip rather than dump long prose.
    pushRow(rows, seen, { kanji, reading, meaning: "" });
  }

  return rows;
}

function pushRow(
  rows: VocabRow[],
  seen: Set<string>,
  parts: { kanji: string; reading: string; meaning: string },
) {
  const kanji = parts.kanji;
  const reading = parts.reading;
  const meaning = parts.meaning;

  if (!isValidVocabEntry(kanji, reading, meaning)) return;

  const key = `${kanji}::${reading}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  rows.push({
    id: uid("card"),
    kanji,
    reading,
    meaning,
  });
}

/** Keep only a real Japanese headword; drop blanks / junk. */
export function cleanHeadword(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  if (PLACEHOLDER_RE.test(text)) return "";
  if (!JP_CHAR_RE.test(text)) return "";
  // Reject option-like noise ("1", "A", "①") and mostly non-JP garble.
  const jpChars = Array.from(text).filter((ch) => JP_CHAR_RE.test(ch));
  if (jpChars.length === 0) return "";
  if (jpChars.length / Array.from(text).length < 0.5) return "";
  return Array.from(text).slice(0, 40).join("").trim();
}

/**
 * Normalize a reading to kana. Empty is OK for kana-only headwords;
 * kanji headwords need a real kana reading or the row is dropped later.
 */
export function cleanReading(raw: string | null | undefined, headword: string): string {
  let text = (raw ?? "").trim().replace(/\s+/g, "");
  if (!text) {
    // Kana-only surface can serve as its own reading.
    if (headword && !hasKanji(headword) && KANA_READING_RE.test(headword)) return headword;
    return "";
  }
  // Strip accidental markup wrappers.
  text = text.replace(/[《》\[\]（）()]/g, "").trim();
  if (!KANA_READING_RE.test(text)) return "";
  return Array.from(text).slice(0, 60).join("");
}

/**
 * Pick a single practical Burmese gloss:
 * first sense when several are listed (၊ / ; / · / etc.), clipped short.
 */
export function primaryMeaning(raw: string | null | undefined): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

  // Drop leaked Japanese furigana markup / JP example tails.
  text = text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+《[^》]*》/g, "");
  text = text.replace(/[《》]/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Split multi-sense glosses; keep the first usable Burmese sense.
  const parts = text
    .split(/(?:၊|。|．|;|；|\/|／|\||·|•|\n)+/)
    .map((part) => part.replace(/^[၊。．\s]+|[။။.\s]+$/g, "").trim())
    .filter(Boolean);

  const first = parts[0] ?? "";
  if (!first || !MYANMAR_RE.test(first)) return "";

  // Reject mostly-Latin / mostly-JP "meanings".
  const myanmarChars = Array.from(first).filter((ch) => MYANMAR_RE.test(ch)).length;
  if (myanmarChars < 2) return "";
  if (myanmarChars / Array.from(first).length < 0.45) return "";

  return Array.from(first).slice(0, MEANING_MAX).join("").trim();
}

export function isValidVocabEntry(kanji: string, reading: string, meaning: string): boolean {
  if (!kanji) return false;
  if (!meaning) return false;
  if (PLACEHOLDER_RE.test(kanji)) return false;
  if (!JP_CHAR_RE.test(kanji)) return false;

  if (hasKanji(kanji)) {
    // Kanji words need a clean kana reading for furigana flashcards.
    if (!reading || !KANA_READING_RE.test(reading)) return false;
  } else if (reading && !KANA_READING_RE.test(reading)) {
    return false;
  }

  if (!MYANMAR_RE.test(meaning)) return false;
  return true;
}
