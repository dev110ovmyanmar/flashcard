/**
 * Browser cache for Gemini analysis results.
 * Identical image/text payloads resolve from localStorage without re-calling the API.
 * Entries are cleared day by day: only same local calendar day stays valid.
 */

const PREFIX = "sumi-analysis:v2:";
/** Older prefixes — wiped whenever we touch storage so nothing lingers overnight. */
const LEGACY_PREFIXES = ["sumi-analysis:v1:"] as const;
const INDEX_KEY = `${PREFIX}index`;
const MAX_ENTRIES = 24;
const MAX_VALUE_CHARS = 1_200_000;

function sameLocalDay(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sweepLegacyKeys() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) toRemove.push(key);
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export type AnalysisCacheKind =
  | "ocr"
  | "jlpt"
  | "grammar"
  | "script-text"
  | "script-image"
  | "dokai-image"
  | "dokai-text";

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
  sweepLegacyKeys();
  const now = Date.now();
  const fresh: CacheIndexItem[] = [];
  for (const item of index) {
    if (sameLocalDay(item.savedAt, now)) {
      fresh.push(item);
      continue;
    }
    try {
      localStorage.removeItem(item.key);
    } catch {
      /* ignore */
    }
  }
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
    sweepLegacyKeys();
    const key = await analysisCacheKey(kind, material);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.v !== 1 || parsed.kind !== kind) return null;
    if (typeof parsed.savedAt !== "number" || !sameLocalDay(parsed.savedAt, Date.now())) {
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
      if (!key) continue;
      if (key.startsWith(PREFIX) || LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    return 0;
  }
  return toRemove.filter((key) => key !== INDEX_KEY && !LEGACY_PREFIXES.some((prefix) => key === `${prefix}index`)).length;
}
