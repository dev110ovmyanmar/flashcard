import assert from "node:assert/strict";
import { test } from "node:test";
import { cardGesture } from "./card-gesture";

const still = { x: 0, y: 0 };

test("a short drag does not flip or change cards", () => {
  assert.equal(cardGesture({ x: 12, y: -20 }, still), null);
});

test("a vertical swipe flips the card", () => {
  assert.equal(cardGesture({ x: 8, y: -90 }, still), "flip");
  assert.equal(cardGesture({ x: 0, y: 80 }, still), "flip");
});

test("a horizontal swipe moves between cards", () => {
  assert.equal(cardGesture({ x: -100, y: 10 }, still), "next");
  assert.equal(cardGesture({ x: 100, y: 12 }, still), "previous");
});

test("a quick flick counts even when the finger travels a short way", () => {
  assert.equal(cardGesture({ x: -20, y: 4 }, { x: -900, y: 0 }), "next");
  assert.equal(cardGesture({ x: 4, y: -24 }, { x: 0, y: -800 }), "flip");
});
