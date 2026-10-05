import assert from "node:assert/strict";
import { test } from "node:test";
import { MOCK_TEXTBOOK_PAGE } from "./sample-data";
import { parseVocabLines, rowsFromVision, wordsToLines } from "./parse-vocab";

test("parses a textbook-shaped page, including stacked readings", () => {
  const rows = parseVocabLines(MOCK_TEXTBOOK_PAGE.split("\n"));
  assert.deepEqual(
    rows.map((row) => `${row.kanji}|${row.reading}|${row.meaning}`),
    [
      "経験|けいけん|အတွေ့အကြုံ",
      "経済|けいざい|စီးပွားရေး",
      "政治|せいじ|နိုင်ငံရေး",
      "環境|かんきょう|ပတ်ဝန်းကျင်",
      "影響|えいきょう|သက်ရောက်မှု",
      "比べる|くらべる|နှိုင်းယှဉ်သည်",
      "重要|じゅうよう|အရေးကြီးသော",
      "可能|かのう|ဖြစ်နိုင်သော",
    ],
  );
});

test("keeps okurigana on the headword and splits a glued reading", () => {
  const verb = parseVocabLines(["申し込む　もうしこむ　လျှောက်ထားသည်"]);
  assert.equal(verb[0]?.kanji, "申し込む");
  assert.equal(verb[0]?.reading, "もうしこむ");

  const glued = parseVocabLines(["経験けいけん အတွေ့အကြုံ"]);
  assert.equal(glued[0]?.kanji, "経験");
  assert.equal(glued[0]?.reading, "けいけん");
  assert.equal(glued[0]?.meaning, "အတွေ့အကြုံ");
});

test("clusters vision word boxes into rows", () => {
  const lines = wordsToLines([
    { text: "経験", x: 10, y: 100, h: 20 },
    { text: "けいけん", x: 90, y: 102, h: 18 },
    { text: "အတွေ့အကြုံ", x: 190, y: 99, h: 20 },
    { text: "経済", x: 12, y: 168, h: 20 },
    { text: "けいざい", x: 92, y: 170, h: 18 },
    { text: "စီးပွားရေး", x: 188, y: 166, h: 20 },
  ]);
  const rows = parseVocabLines(lines);
  assert.equal(rows[0]?.kanji, "経験");
  assert.equal(rows[0]?.reading, "けいけん");
  assert.equal(rows[1]?.kanji, "経済");
  assert.equal(rows[1]?.meaning, "စီးပွားရေး");
});

test("reads a document text annotation", () => {
  const result = rowsFromVision({
    responses: [
      {
        fullTextAnnotation: {
          text: "経験 けいけん အတွေ့အကြုံ",
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: "経" }, { text: "験" }],
                          boundingBox: { vertices: [{ x: 10, y: 40 }, { x: 70, y: 40 }, { x: 70, y: 70 }, { x: 10, y: 70 }] },
                        },
                        {
                          symbols: [{ text: "け" }, { text: "い" }, { text: "け" }, { text: "ん" }],
                          boundingBox: { vertices: [{ x: 90, y: 42 }, { x: 160, y: 42 }, { x: 160, y: 68 }, { x: 90, y: 68 }] },
                        },
                        {
                          symbols: [{ text: "အ" }, { text: "တွေ့" }],
                          boundingBox: { vertices: [{ x: 180, y: 40 }, { x: 250, y: 40 }, { x: 250, y: 72 }, { x: 180, y: 72 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.rows[0]?.kanji, "経験");
  assert.equal(result.rows[0]?.reading, "けいけん");
  assert.match(result.rows[0]?.meaning ?? "", /အ/);
});
