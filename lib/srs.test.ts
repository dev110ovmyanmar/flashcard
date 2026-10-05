import assert from "node:assert/strict";
import { test } from "node:test";
import { freshCard } from "./decks";
import { applyGrade, isWeak } from "./srs";

test("easy schedules a review and hard returns the card to the weak list", () => {
  const now = 1_700_000_000_000;
  const card = freshCard({ id: "card_1", kanji: "経験", reading: "けいけん", meaning: "အတွေ့အကြုံ" }, now);
  assert.equal(isWeak(card), false);

  const hard = applyGrade(card, "hard", now);
  assert.equal(hard.lastGrade, "hard");
  assert.equal(hard.repetitions, 0);
  assert.equal(hard.lapses, 1);
  assert.equal(hard.dueAt, now);
  assert.equal(isWeak(hard), true);
  assert.ok(hard.ease < card.ease);

  const firstEasy = applyGrade(hard, "easy", now);
  assert.equal(firstEasy.intervalDays, 1);
  assert.equal(firstEasy.repetitions, 1);
  assert.equal(firstEasy.lastGrade, "easy");
  assert.equal(isWeak(firstEasy), false);
  assert.equal(firstEasy.dueAt, now + 86_400_000);

  const secondEasy = applyGrade(firstEasy, "easy", now);
  assert.equal(secondEasy.intervalDays, 3);
  assert.equal(secondEasy.repetitions, 2);
});
