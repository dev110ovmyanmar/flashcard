import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGoiBackup, parseGoiBackup, serializeGoiBackup } from "./backup";

test("serializes and parses a Sumi Goi backup envelope", () => {
  const backup = buildGoiBackup({
    version: 1,
    seeded: true,
    decks: [
      {
        id: "deck_1",
        name: "Goi",
        createdAt: 1,
        updatedAt: 2,
        source: "jlpt",
        cards: [
          {
            id: "card_1",
            kanji: "経験",
            reading: "けいけん",
            meaning: "အတွေ့အကြုံ",
            ease: 2.5,
            intervalDays: 0,
            repetitions: 0,
            dueAt: 1,
            lapses: 0,
            reviews: 0,
          },
        ],
      },
    ],
  });

  const restored = parseGoiBackup(serializeGoiBackup(backup));
  assert.equal(restored.decks.length, 1);
  assert.equal(restored.decks[0]?.name, "Goi");
  assert.equal(restored.decks[0]?.cards[0]?.kanji, "経験");
  assert.equal(restored.decks[0]?.source, "jlpt");
});

test("parses a decks-only JSON payload", () => {
  const restored = parseGoiBackup(
    JSON.stringify({
      decks: [
        {
          id: "deck_2",
          name: "Typed",
          createdAt: 1,
          updatedAt: 1,
          source: "manual",
          cards: [],
        },
      ],
    }),
  );
  assert.equal(restored.decks[0]?.name, "Typed");
});
