import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPageKind, sectionMismatchError } from "./analyzer-section";

describe("sectionMismatchError", () => {
  it("errors when vocabulary analyzer gets a grammar page", () => {
    assert.match(
      sectionMismatchError("vocabulary", "grammar") ?? "",
      /Grammar Analyzer/i,
    );
  });

  it("errors when grammar analyzer gets a vocabulary page", () => {
    assert.match(
      sectionMismatchError("grammar", "vocabulary") ?? "",
      /Vocabulary Analyzer/i,
    );
  });

  it("errors when script analyzer gets an exam page", () => {
    assert.match(
      sectionMismatchError("script", "vocabulary") ?? "",
      /Vocabulary Analyzer/i,
    );
    assert.match(
      sectionMismatchError("script", "grammar") ?? "",
      /Grammar Analyzer/i,
    );
  });

  it("does not error when the section matches", () => {
    assert.equal(sectionMismatchError("vocabulary", "vocabulary"), null);
    assert.equal(sectionMismatchError("grammar", "grammar"), null);
    assert.equal(sectionMismatchError("script", "script"), null);
  });

  it("does not error for unknown / empty / other kinds", () => {
    assert.equal(sectionMismatchError("vocabulary", null), null);
    assert.equal(sectionMismatchError("vocabulary", "empty"), null);
    assert.equal(sectionMismatchError("vocabulary", "other"), null);
    assert.equal(sectionMismatchError("vocabulary", "mixed"), null);
  });
});

describe("extractPageKind", () => {
  it("reads page_kind from payload roots", () => {
    assert.equal(extractPageKind({ page_kind: "grammar", questions: [] }), "grammar");
    assert.equal(extractPageKind({ pageKind: "script" }), "script");
  });
});
