import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisCacheKey, clearAnalysisCache, setAnalysisCache, getAnalysisCache } from "./analysis-cache";

test("analysis cache keys are stable and kind-scoped", async () => {
  const a = await analysisCacheKey("jlpt", "abc");
  const b = await analysisCacheKey("jlpt", "abc");
  const c = await analysisCacheKey("grammar", "abc");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^sumi-analysis:v1:jlpt:/);
});

test("clearAnalysisCache removes stored payloads", async () => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });

  await setAnalysisCache("jlpt", "page-a", { questions: [1] });
  await setAnalysisCache("grammar", "page-b", { questions: [2] });
  assert.deepEqual(await getAnalysisCache("jlpt", "page-a"), { questions: [1] });

  const cleared = clearAnalysisCache();
  assert.equal(cleared, 2);
  assert.equal(await getAnalysisCache("jlpt", "page-a"), null);
  assert.equal(await getAnalysisCache("grammar", "page-b"), null);
  assert.equal(clearAnalysisCache(), 0);
});
