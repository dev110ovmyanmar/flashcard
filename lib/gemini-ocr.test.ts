import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGeminiRequest, geminiModelChain, geminiModelName, rowsFromGemini, shouldTryNextModel, thinkingLevelFor } from "./gemini-ocr";

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

test("starts on Flash-Lite and keeps Gemini 3.8 off minimal thinking", () => {
  const request = buildGeminiRequest("abc", "image/jpeg");
  assert.equal(request.model, "gemini-3.5-flash-lite");
  assert.equal("thinking_level" in request.generation_config ? request.generation_config.thinking_level : undefined, "minimal");
  assert.equal(request.generation_config.max_output_tokens, 3072);
  assert.equal(thinkingLevelFor("gemini-3.8-flash"), "low");
});

test("falls through to another Flash model when one is at capacity", () => {
  assert.deepEqual(geminiModelChain(undefined).slice(0, 3), [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
  ]);
  assert.equal(geminiModelChain("gemini-3.7-flash").filter((model) => model === "gemini-3.7-flash").length, 1);
  assert.equal(
    shouldTryNextModel(503, "gemini-3.8-flash is currently experiencing high demand, spikes in demand are usually temporary. Please try again later."),
    true,
  );
  assert.equal(shouldTryNextModel(400, "API key not valid."), false);
});

test("rejects a model name that is not a single token", () => {
  assert.equal(geminiModelName("models/gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
  assert.equal(geminiModelName("gemini/../other"), "gemini-3.5-flash-lite");
  assert.equal(geminiModelName(undefined), "gemini-3.5-flash-lite");
});
