export type Grade = "easy" | "hard";

export type DeckSource = "sample" | "scan" | "manual";

export type ScanMode = "gemini" | "mock";

export type Card = {
  id: string;
  kanji: string;
  reading: string;
  meaning: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number;
  lapses: number;
  reviews: number;
  lastGrade?: Grade;
};

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: DeckSource;
  scanMode?: ScanMode;
  cards: Card[];
};

export type VocabRow = {
  id: string;
  kanji: string;
  reading: string;
  meaning: string;
};

export type ParsedRow = {
  kanji: string;
  reading: string;
  meaning: string;
};

export type OcrSuccess = {
  ok: true;
  source: ScanMode;
  message: string;
  rows: ParsedRow[];
  rawText: string;
};

export type OcrFailure = {
  ok: false;
  error: string;
};

export type PersistedState = {
  version: 1;
  seeded: boolean;
  decks: Deck[];
};
