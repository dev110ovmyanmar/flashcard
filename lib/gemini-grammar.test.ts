import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GRAMMAR_DEFAULT_GEMINI_MODEL,
  GRAMMAR_RESPONSE_SCHEMA,
  grammarGeminiModelChain,
  grammarGeminiModelName,
  questionsFromGrammarGemini,
} from "./gemini-grammar";
import { Type } from "@google/genai";

describe("grammarGeminiModelName", () => {
  it("defaults to gemini-2.5-flash", () => {
    assert.equal(grammarGeminiModelName(undefined), GRAMMAR_DEFAULT_GEMINI_MODEL);
    assert.equal(grammarGeminiModelName(""), GRAMMAR_DEFAULT_GEMINI_MODEL);
  });

  it("accepts a custom model and strips models/ prefix", () => {
    assert.equal(grammarGeminiModelName("models/gemini-3.5-flash"), "gemini-3.5-flash");
  });
});

describe("grammarGeminiModelChain", () => {
  it("puts the preferred model first without duplicates", () => {
    const chain = grammarGeminiModelChain("gemini-3.5-flash");
    assert.equal(chain[0], "gemini-3.5-flash");
    assert.equal(chain.filter((m) => m === "gemini-3.5-flash").length, 1);
  });
});

describe("GRAMMAR_RESPONSE_SCHEMA", () => {
  it("requires the grammar question fields", () => {
    assert.equal(GRAMMAR_RESPONSE_SCHEMA.type, Type.OBJECT);
    assert.deepEqual(GRAMMAR_RESPONSE_SCHEMA.required, ["questions"]);
    const item = GRAMMAR_RESPONSE_SCHEMA.properties?.questions?.items;
    assert.ok(item);
    assert.deepEqual(item.required, [
      "questionNumber",
      "questionText",
      "correctAnswer",
      "grammarPattern",
      "correctReasonBurmese",
      "incorrectReasonsBurmese",
    ]);
  });
});

describe("questionsFromGrammarGemini", () => {
  it("parses a JSON string payload", () => {
    const raw = JSON.stringify({
      questions: [
        {
          questionNumber: "1",
          questionText: "彼は忙しい_____、いつも笑顔だ。",
          correctAnswer: "1",
          grammarPattern: "～にもかかわらず",
          correctReasonBurmese: "ဆန့်ကျင်ဘက်ဖြစ်သောကြောင့်",
          incorrectReasonsBurmese:
            "2 にかかわらず: မကိုက်ညီ။ ဥပမာ: 年齢にかかわらず参加できる。",
        },
      ],
    });
    const parsed = questionsFromGrammarGemini(raw);
    assert.equal(parsed.questions.length, 1);
    assert.equal(parsed.questions[0]?.grammarPattern, "～にもかかわらず");
    assert.equal(parsed.questions[0]?.correctAnswer, "1");
  });

  it("normalizes snake_case keys", () => {
    const parsed = questionsFromGrammarGemini({
      questions: [
        {
          question_number: "★2",
          question_text: "テスト文",
          correct_answer: "3",
          grammar_pattern: "～ものなら",
          correct_reason_burmese: "မှန်",
          incorrect_reasons_burmese: "မမှန်",
        },
      ],
    });
    assert.equal(parsed.questions[0]?.questionNumber, "★2");
    assert.equal(parsed.questions[0]?.grammarPattern, "～ものなら");
  });

  it("returns an error for empty payloads", () => {
    const parsed = questionsFromGrammarGemini(null);
    assert.equal(parsed.questions.length, 0);
    assert.ok(parsed.error);
  });
});
