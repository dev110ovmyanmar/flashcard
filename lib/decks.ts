import { uid } from "@/lib/id";
import { isWeak } from "@/lib/srs";
import type { Card, Deck, DeckSource, ScanMode, VocabRow } from "@/lib/types";

export function freshCard(row: Pick<VocabRow, "id" | "kanji" | "reading" | "meaning">, now = Date.now()): Card {
  return {
    id: row.id || uid("card"),
    kanji: row.kanji.trim(),
    reading: row.reading.trim(),
    meaning: row.meaning.trim(),
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: now,
    lapses: 0,
    reviews: 0,
  };
}

export function createDeck(input: {
  name: string;
  rows: VocabRow[];
  source: DeckSource;
  scanMode?: ScanMode;
  now?: number;
}): Deck {
  const now = input.now ?? Date.now();
  return {
    id: uid("deck"),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
    source: input.source,
    scanMode: input.scanMode,
    cards: input.rows.filter((row) => row.kanji.trim()).map((row) => freshCard(row, now)),
  };
}

export function mergeDeck(deck: Deck, name: string, rows: VocabRow[], now = Date.now()): Deck {
  const cards = rows
    .filter((row) => row.kanji.trim())
    .map((row) => {
      const previous = deck.cards.find((card) => card.id === row.id);
      if (!previous) return freshCard(row, now);
      return {
        ...previous,
        kanji: row.kanji.trim(),
        reading: row.reading.trim(),
        meaning: row.meaning.trim(),
      };
    });

  return {
    ...deck,
    name: name.trim(),
    cards,
    updatedAt: now,
  };
}

export function deckStats(deck: Deck) {
  const total = deck.cards.length;
  const weak = deck.cards.filter(isWeak).length;
  const remembered = deck.cards.filter((card) => card.lastGrade === "easy").length;
  return { total, weak, remembered };
}

export function blankRows(count = 3): VocabRow[] {
  return Array.from({ length: count }, () => ({
    id: uid("card"),
    kanji: "",
    reading: "",
    meaning: "",
  }));
}

export function withIds(rows: Array<Pick<VocabRow, "kanji" | "reading" | "meaning">>): VocabRow[] {
  return rows.map((row) => ({
    id: uid("card"),
    kanji: row.kanji,
    reading: row.reading,
    meaning: row.meaning,
  }));
}
