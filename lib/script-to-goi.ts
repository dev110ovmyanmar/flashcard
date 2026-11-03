import { uid } from "@/lib/id";
import { cleanHeadword, cleanReading, isValidVocabEntry, primaryMeaning } from "@/lib/jlpt-to-goi";
import type { ScriptGrammarItem, ScriptVocabItem } from "@/src/constants/scriptPrompt";
import type { VocabRow } from "@/lib/types";

/** Turn script vocabulary items into Goi flashcard rows (Burmese gloss only). */
export function scriptVocabToRows(items: ScriptVocabItem[]): VocabRow[] {
  const rows: VocabRow[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const kanji = cleanHeadword(item.word);
    const reading = cleanReading(item.reading, kanji);
    const meaning = primaryMeaning(item.meaning_burmese);
    if (!isValidVocabEntry(kanji, reading, meaning)) continue;
    pushRow(rows, seen, { kanji, reading, meaning });
  }

  return rows;
}

/**
 * Turn script grammar points into flashcard rows.
 * Face = pattern (stripped of markup), meaning = Burmese explanation.
 */
export function scriptGrammarToRows(items: ScriptGrammarItem[]): VocabRow[] {
  const rows: VocabRow[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const kanji = cleanPatternFace(item.pattern);
    const reading = cleanReading(item.reading || extractReadingFromMarkup(item.pattern), kanji);
    const meaning = primaryMeaning(item.explanation_burmese);
    if (!kanji || !meaning) continue;
    pushRow(rows, seen, { kanji, reading, meaning });
  }

  return rows;
}

function pushRow(
  rows: VocabRow[],
  seen: Set<string>,
  parts: { kanji: string; reading: string; meaning: string },
) {
  const key = `${parts.kanji}::${parts.reading}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    id: uid("card"),
    kanji: parts.kanji,
    reading: parts.reading,
    meaning: parts.meaning,
  });
}

function cleanPatternFace(raw: string): string {
  const stripped = raw
    .replace(/《[^》]*》/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*]/g, "")
    .trim();
  return cleanHeadword(stripped) || stripped.slice(0, 40).trim();
}

function extractReadingFromMarkup(raw: string): string {
  const match = raw.match(/《([^》]+)》/);
  return match?.[1]?.trim() ?? "";
}
