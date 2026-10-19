import assert from "node:assert/strict";
import { test } from "node:test";
import { cardFace, createDeck, mergeDeck } from "./decks";
import type { Deck } from "./types";

test("keeps a hiragana word and shows it on the card front", () => {
  const deck = createDeck({
    name: "Kana",
    source: "manual",
    now: 1,
    rows: [
      { id: "card_kana", kanji: "", reading: "きれい", meaning: "လှပသည်" },
      { id: "card_blank", kanji: "  ", reading: " ", meaning: "အလွတ်" },
    ],
  });

  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0]?.reading, "きれい");
  assert.equal(cardFace(deck.cards[0]!), "きれい");
  assert.equal(cardFace({ kanji: "経験", reading: "けいけん" }), "経験");
});

test("keeps a hiragana card when a deck is edited", () => {
  const existing: Deck = {
    id: "deck_1",
    name: "Kana",
    createdAt: 1,
    updatedAt: 1,
    source: "manual",
    cards: [
      {
        id: "card_kana",
        kanji: "",
        reading: "きれい",
        meaning: "လှပသည်",
        ease: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: 1,
        lapses: 0,
        reviews: 2,
      },
    ],
  };

  const next = mergeDeck(
    existing,
    "Kana",
    [{ id: "card_kana", kanji: "", reading: "きれい", meaning: "လှပသည်" }],
    2,
  );
  assert.equal(next.cards.length, 1);
  assert.equal(next.cards[0]?.reviews, 2);
  assert.equal(cardFace(next.cards[0]!), "きれい");
});
