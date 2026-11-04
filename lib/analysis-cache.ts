/**
 * Browser cache for Gemini analysis results.
 * Identical image/text payloads resolve from localStorage without re-calling the API.
 */

const PREFIX = "sumi-analysis:v1:";
const INDEX_KEY = `${PREFIX}index`;
const MAX_ENTRIES = 24;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_VALUE_CHARS = 1_200_000;

export type AnalysisCacheKind = "ocr" | "jlpt" | "grammar" | "script-text" | "script-image";

type CacheIndexItem = { key: string; savedAt: number; kind: AnalysisCacheKind };

type CacheEnvelope<T> = {
  v: 1;
  kind: AnalysisCacheKind;
  savedAt: number;
  payload: T;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readIndex(): CacheIndexItem[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CacheIndexItem =>
        isRecord(item) &&
        typeof item.key === "string" &&
        typeof item.savedAt === "number" &&
        typeof item.kind === "string",
    );
  } catch {
    return [];
  }
}

function writeIndex(items: CacheIndexItem[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items.slice(0, MAX_ENTRIES)));
}

function prune(index: CacheIndexItem[]): CacheIndexItem[] {
  const now = Date.now();
  const fresh = index.filter((item) => now - item.savedAt < TTL_MS);
  while (fresh.length > MAX_ENTRIES) {
    const oldest = fresh.pop();
    if (!oldest) break;
    try {
      localStorage.removeItem(oldest.key);
    } catch {
      /* ignore */
    }
  }
  return fresh;
}

export async function analysisCacheKey(
  kind: AnalysisCacheKind,
  material: string,
): Promise<string> {
  const hash = await sha256Hex(`${kind}:${material}`);
  return `${PREFIX}${kind}:${hash}`;
}

export async function getAnalysisCache<T>(
  kind: AnalysisCacheKind,
  material: string,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  try {
    const key = await analysisCacheKey(kind, material);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.v !== 1 || parsed.kind !== kind) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.payload as T;
  } catch {
    return null;
  }
}

export async function setAnalysisCache<T>(
  kind: AnalysisCacheKind,
  material: string,
  payload: T,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const key = await analysisCacheKey(kind, material);
    const envelope: CacheEnvelope<T> = {
      v: 1,
      kind,
      savedAt: Date.now(),
      payload,
    };
    const serialized = JSON.stringify(envelope);
    if (serialized.length > MAX_VALUE_CHARS) return;

    let index = prune(readIndex().filter((item) => item.key !== key));
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // Quota — drop oldest and retry once.
      index = prune(index);
      const drop = index.pop();
      if (drop) localStorage.removeItem(drop.key);
      localStorage.setItem(key, serialized);
    }
    index.unshift({ key, savedAt: envelope.savedAt, kind });
    writeIndex(prune(index));
  } catch {
    /* storage unavailable */
  }
}

/** Remove every analysis cache entry (and index). Returns how many payloads were deleted. */
export function clearAnalysisCache(): number {
  if (typeof window === "undefined") return 0;
  const toRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    return 0;
  }
  return toRemove.filter((key) => key !== INDEX_KEY).length;
}
