import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiModelName, rowsFromGemini } from "./gemini-ocr";

test("reads structured rows from an Interactions response", () => {
  const result = rowsFromGemini({
    status: "completed",
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              rows: [
                { kanji: "経験", reading: "けいけん", meaning: "အတွေ့အကြုံ" },
                { word: "申し込む", yomi: "もうしこむ", myanmar: "လျှောက်ထားသည်" },
              ],
            }),
          },
        ],
      },
    ],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0]?.kanji, "経験");
  assert.equal(result.rows[0]?.reading, "けいけん");
  assert.equal(result.rows[1]?.kanji, "申し込む");
  assert.equal(result.rows[1]?.reading, "もうしこむ");
  assert.equal(result.rows[1]?.meaning, "လျှောက်ထားသည်");
});

test("reads structured rows from a Gemini candidate", () => {
  const result = rowsFromGemini({
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                rows: [
                  { kanji: "経験", reading: "けいけん", meaning: "အတွေ့အကြုံ" },
                  { word: "申し込む", yomi: "もうしこむ", myanmar: "လျှောက်ထားသည်" },
                ],
              }),
            },
          ],
        },
        finishReason: "STOP",
      },
    ],
  });

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0]?.kanji, "経験");
  assert.equal(result.rows[0]?.reading, "けいけん");
  assert.equal(result.rows[1]?.kanji, "申し込む");
  assert.equal(result.rows[1]?.reading, "もうしこむ");
  assert.equal(result.rows[1]?.meaning, "လျှောက်ထားသည်");
});

test("unwraps a fenced JSON payload and splits a glued reading", () => {
  const result = rowsFromGemini({
    candidates: [
      {
        content: {
          parts: [
            {
              text: "```json\n{\"rows\":[{\"kanji\":\"経験けいけん\",\"reading\":\"\",\"meaning\":\"အတွေ့အကြုံ\"}]}\n```",
            },
          ],
        },
      },
    ],
  });
  assert.equal(result.rows[0]?.kanji, "経験");
  assert.equal(result.rows[0]?.reading, "けいけん");
});

test("falls back to the textbook line parser when the model returns plain text", () => {
  const result = rowsFromGemini({
    candidates: [
      {
        content: {
          parts: [{ text: "経験　けいけん　အတွေ့အကြုံ\n経済　けいざい　စီးပွားရေး" }],
        },
      },
    ],
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]?.kanji, "経済");
});

test("surfaces a Gemini error and a blocked photo", () => {
  const failed = rowsFromGemini({ error: { message: "API key not valid." } });
  assert.match(failed.error ?? "", /API key not valid/);

  const blocked = rowsFromGemini({
    promptFeedback: { blockReason: "SAFETY" },
    candidates: [],
  });
  assert.match(blocked.error ?? "", /blocked/i);
});

test("rejects a model name that is not a single token", () => {
  assert.equal(geminiModelName("models/gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(geminiModelName("gemini/../other"), "gemini-3.8-flash");
  assert.equal(geminiModelName(undefined), "gemini-3.8-flash");
});
