import type { Card, Deck, DeckSource, Grade, PersistedState, ScanMode } from "@/lib/types";

export const STORAGE_KEY = "sumi.decks.v1";

export type LoadedState = PersistedState & { corrupt: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSource(value: unknown): DeckSource {
  if (value === "sample" || value === "scan" || value === "manual") return value;
  return "manual";
}

function asScanMode(value: unknown): ScanMode | undefined {
  if (value === "vision" || value === "mock") return value;
  return undefined;
}

function asGrade(value: unknown): Grade | undefined {
  if (value === "easy" || value === "hard") return value;
  return undefined;
}

function sanitizeCard(value: unknown): Card | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.kanji !== "string") return null;
  return {
    id: value.id,
    kanji: value.kanji,
    reading: typeof value.reading === "string" ? value.reading : "",
    meaning: typeof value.meaning === "string" ? value.meaning : "",
    ease: typeof value.ease === "number" ? value.ease : 2.5,
    intervalDays: typeof value.intervalDays === "number" ? value.intervalDays : 0,
    repetitions: typeof value.repetitions === "number" ? value.repetitions : 0,
    dueAt: typeof value.dueAt === "number" ? value.dueAt : Date.now(),
    lapses: typeof value.lapses === "number" ? value.lapses : 0,
    reviews: typeof value.reviews === "number" ? value.reviews : 0,
    lastGrade: asGrade(value.lastGrade),
  };
}

function sanitizeDeck(value: unknown): Deck | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string" || !Array.isArray(value.cards)) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
    source: asSource(value.source),
    scanMode: asScanMode(value.scanMode),
    cards: value.cards.map(sanitizeCard).filter((card): card is Card => card !== null),
  };
}

export function loadState(): LoadedState {
  if (typeof window === "undefined") {
    return { version: 1, seeded: false, decks: [], corrupt: false };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { version: 1, seeded: false, decks: [], corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.decks)) {
      return { version: 1, seeded: false, decks: [], corrupt: true };
    }
    return {
      version: 1,
      seeded: Boolean(parsed.seeded),
      decks: parsed.decks.map(sanitizeDeck).filter((deck): deck is Deck => deck !== null),
      corrupt: false,
    };
  } catch {
    return { version: 1, seeded: false, decks: [], corrupt: true };
  }
}

export function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new Error("This browser couldn't save the deck. Storage may be full.");
  }
}
