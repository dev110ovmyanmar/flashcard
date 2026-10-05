"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createSampleDeck } from "@/lib/sample-data";
import { applyGrade } from "@/lib/srs";
import { loadState, saveState } from "@/lib/storage";
import type { Card, Deck, Grade } from "@/lib/types";

type DeckSnapshot = {
  decks: Deck[];
  corrupt: boolean;
  hydrated: boolean;
};

const SERVER_SNAPSHOT: DeckSnapshot = { decks: [], corrupt: false, hydrated: false };

let snapshot: DeckSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function publish(next: DeckSnapshot) {
  snapshot = next;
  emit();
}

function ensureClientSnapshot(): DeckSnapshot {
  if (snapshot.hydrated) return snapshot;
  const loaded = loadState();
  if (loaded.corrupt) {
    snapshot = { decks: [], corrupt: true, hydrated: true };
    return snapshot;
  }
  if (!loaded.seeded && loaded.decks.length === 0) {
    const decks = [createSampleDeck()];
    try {
      saveState({ version: 1, seeded: true, decks });
    } catch {
      // The sample still shows in memory. The next explicit save will try again.
    }
    snapshot = { decks, corrupt: false, hydrated: true };
    return snapshot;
  }
  snapshot = { decks: loaded.decks, corrupt: false, hydrated: true };
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return ensureClientSnapshot();
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function commit(decks: Deck[]) {
  try {
    saveState({ version: 1, seeded: true, decks });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't save on this device.");
  }
  publish({ decks, corrupt: false, hydrated: true });
}

export function useDecks() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addDeck = useCallback((deck: Deck) => {
    const current = getSnapshot().decks;
    commit([deck, ...current.filter((item) => item.id !== deck.id)]);
  }, []);

  const saveDeck = useCallback((deck: Deck) => {
    const current = getSnapshot().decks;
    commit(current.map((item) => (item.id === deck.id ? deck : item)));
  }, []);

  const deleteDeck = useCallback((id: string) => {
    const current = getSnapshot().decks;
    commit(current.filter((item) => item.id !== id));
  }, []);

  const gradeCard = useCallback((deckId: string, cardId: string, grade: Grade) => {
    const current = getSnapshot().decks;
    const now = Date.now();
    commit(
      current.map((deck) => {
        if (deck.id !== deckId) return deck;
        return {
          ...deck,
          updatedAt: now,
          cards: deck.cards.map((card) => (card.id === cardId ? applyGrade(card, grade, now) : card)),
        };
      }),
    );
  }, []);

  const restoreCard = useCallback((deckId: string, card: Card) => {
    const current = getSnapshot().decks;
    commit(
      current.map((deck) => {
        if (deck.id !== deckId) return deck;
        return {
          ...deck,
          updatedAt: Date.now(),
          cards: deck.cards.map((item) => (item.id === card.id ? card : item)),
        };
      }),
    );
  }, []);

  const startFresh = useCallback(() => {
    commit([createSampleDeck()]);
  }, []);

  return {
    decks: state.hydrated ? state.decks : null,
    ready: state.hydrated,
    corrupt: state.corrupt,
    addDeck,
    saveDeck,
    deleteDeck,
    gradeCard,
    restoreCard,
    startFresh,
  };
}
