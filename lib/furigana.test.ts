import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annotateProse,
  applyReadingMap,
  harvestMarkupReadings,
  hasKanji,
  parseFuriganaMarkup,
  resolveFuriganaSegments,
  splitScriptRuns,
} from "./furigana";

test("detects kanji", () => {
  assert.equal(hasKanji("事故"), true);
  assert.equal(hasKanji("この"), false);
  assert.equal(hasKanji("_____"), false);
});

test("parses 《》 and [] furigana markup", () => {
  assert.deepEqual(parseFuriganaMarkup("この事故《じこ》は"), [
    { surface: "この" },
    { surface: "事故", reading: "じこ" },
    { surface: "は" },
  ]);
  assert.deepEqual(parseFuriganaMarkup("会社[かいしゃ]"), [
    { surface: "会社", reading: "かいしゃ" },
  ]);
  assert.deepEqual(parseFuriganaMarkup("にかかわらず《にかかわらず》"), [
    { surface: "にかかわらず", reading: "にかかわらず" },
  ]);
  assert.deepEqual(parseFuriganaMarkup("～にもかかわらず《にもかかわらず》"), [
    { surface: "～" },
    { surface: "にもかかわらず", reading: "にもかかわらず" },
  ]);
});

test("applies a reading map longest-first", () => {
  const segments = applyReadingMap("自動車会社", {
    自動車: "じどうしゃ",
    車: "くるま",
    会社: "かいしゃ",
  });
  assert.deepEqual(segments, [
    { surface: "自動車", reading: "じどうしゃ" },
    { surface: "会社", reading: "かいしゃ" },
  ]);
});

test("resolveFuriganaSegments prefers tokens, then map, then reading", () => {
  assert.deepEqual(
    resolveFuriganaSegments({
      text: "失敗",
      tokens: [{ surface: "失敗", reading: "しっぱい" }],
      reading: "wrong",
    }),
    [{ surface: "失敗", reading: "しっぱい" }],
  );
  assert.deepEqual(
    resolveFuriganaSegments({ text: "失敗", reading: "しっぱい" }),
    [{ surface: "失敗", reading: "しっぱい" }],
  );
});

test("resolveFuriganaSegments pairs reading onto kanji only in Burmese prose", () => {
  assert.deepEqual(
    resolveFuriganaSegments({ text: "ဥပမာ: 安心။", reading: "あんしん" }),
    [
      { surface: "ဥပမာ: " },
      { surface: "安心", reading: "あんしん" },
      { surface: "။" },
    ],
  );
  assert.deepEqual(
    resolveFuriganaSegments({ text: "安心", reading: "あんしん" }),
    [{ surface: "安心", reading: "あんしん" }],
  );
});

test("resolveFuriganaSegments fills missing token readings from the map", () => {
  assert.deepEqual(
    resolveFuriganaSegments({
      text: "計画は失敗",
      tokens: [
        { surface: "計画", reading: "" },
        { surface: "は", reading: "" },
        { surface: "失敗", reading: "" },
      ],
      readings: { 計画: "けいかく", 失敗: "しっぱい" },
    }),
    [
      { surface: "計画", reading: "けいかく" },
      { surface: "は" },
      { surface: "失敗", reading: "しっぱい" },
    ],
  );
});

test("annotateProse mixes markup and reading map in Burmese prose", () => {
  assert.deepEqual(
    annotateProse("現実的《げんじつてき》 က ဆန့်ကျင်ဘက်။ 積極的 လည်း မကိုက်။", {
      積極的: "せっきょくてき",
    }),
    [
      { surface: "現実的", reading: "げんじつてき" },
      { surface: " က ဆန့်ကျင်ဘက်။ " },
      { surface: "積極的", reading: "せっきょくてき" },
      { surface: " လည်း မကိုက်။" },
    ],
  );
});

test("splitScriptRuns isolates Japanese inside Burmese", () => {
  assert.deepEqual(splitScriptRuns("正解သည် 失敗 ဖြစ်သည်"), [
    { surface: "正解" },
    { surface: "သည် " },
    { surface: "失敗" },
    { surface: " ဖြစ်သည်" },
  ]);
});

test("harvestMarkupReadings collects pairs into a map", () => {
  const map = harvestMarkupReadings("非現実的《ひげんじつてき》 နှင့် 現実的《げんじつてき》");
  assert.equal(map["非現実的"], "ひげんじつてき");
  assert.equal(map["現実的"], "げんじつてき");
});
