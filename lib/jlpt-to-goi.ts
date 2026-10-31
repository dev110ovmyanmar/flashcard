import { uid } from "@/lib/id";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";
import type { VocabRow } from "@/lib/types";

function buildMeaning(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

/**
 * Turn analyzed JLPT questions into Goi flashcard rows.
 * Saves every option (正解 + distractors) so learners can review the full set.
 */
export function jlptQuestionsToVocabRows(questions: JlptQuestion[]): VocabRow[] {
  const rows: VocabRow[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const correctKey = question.correct_option.trim();

    if (question.options_table.length > 0) {
      for (const option of question.options_table) {
        const isCorrect = option.option.trim() !== "" && option.option.trim() === correctKey;
        const kanji = option.japanese.trim();
        const reading = (option.reading || (isCorrect ? question.reading : "")).trim();
        const meaning = buildMeaning([
          option.meaning_burmese,
          option.usage_burmese,
          !isCorrect && option.why_wrong_burmese
            ? `（誤: ${option.why_wrong_burmese}）`
            : isCorrect
              ? "（正解）"
              : undefined,
        ]);
        pushRow(rows, seen, { kanji, reading, meaning });
      }
      continue;
    }

    // Fallback when options were not parsed: save the target word alone.
    const kanji = question.target_word.trim();
    const reading = question.reading.trim();
    const meaning = buildMeaning([question.explanation_burmese, question.nuance_note]);
    pushRow(rows, seen, { kanji, reading, meaning });
  }

  return rows;
}

function pushRow(
  rows: VocabRow[],
  seen: Set<string>,
  parts: { kanji: string; reading: string; meaning: string },
) {
  const { kanji, reading, meaning } = parts;
  if (!kanji && !reading) return;

  const key = `${kanji}::${reading}::${meaning}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  rows.push({
    id: uid("card"),
    kanji,
    reading,
    meaning,
  });
}
