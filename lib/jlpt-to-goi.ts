import { uid } from "@/lib/id";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";
import type { VocabRow } from "@/lib/types";

/** Turn analyzed JLPT questions into Goi flashcard rows (正解 / target word). */
export function jlptQuestionsToVocabRows(questions: JlptQuestion[]): VocabRow[] {
  const rows: VocabRow[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const correct = question.options_table.find(
      (row) => row.option.trim() !== "" && row.option.trim() === question.correct_option.trim(),
    );
    const kanji = (correct?.japanese || question.target_word || "").trim();
    const reading = question.reading.trim();
    const meaning = (correct?.meaning_burmese || "").trim();
    if (!kanji && !reading) continue;

    const key = `${kanji}::${reading}::${meaning}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      id: uid("card"),
      kanji,
      reading,
      meaning,
    });
  }

  return rows;
}
