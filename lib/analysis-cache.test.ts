import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisCacheKey } from "./analysis-cache";

test("analysis cache keys are stable and kind-scoped", async () => {
  const a = await analysisCacheKey("jlpt", "abc");
  const b = await analysisCacheKey("jlpt", "abc");
  const c = await analysisCacheKey("grammar", "abc");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^sumi-analysis:v1:jlpt:/);
});
