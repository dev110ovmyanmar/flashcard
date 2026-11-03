export type AnalyzerSection = "vocabulary" | "grammar" | "script";

export type AnalyzerPageKind =
  | "vocabulary"
  | "grammar"
  | "script"
  | "mixed"
  | "other"
  | "empty";

const PAGE_KINDS = new Set<AnalyzerPageKind>([
  "vocabulary",
  "grammar",
  "script",
  "mixed",
  "other",
  "empty",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asPageKind(value: unknown): AnalyzerPageKind | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase() as AnalyzerPageKind;
  return PAGE_KINDS.has(key) ? key : null;
}

/** Read page_kind from a Gemini payload or parsed JSON root. */
export function extractPageKind(payload: unknown): AnalyzerPageKind | null {
  if (!isRecord(payload)) return null;
  return (
    asPageKind(payload.page_kind) ??
    asPageKind(payload.pageKind) ??
    asPageKind(payload.content_type) ??
    asPageKind(payload.contentType)
  );
}

export function parseJsonRoot(text: string): unknown | null {
  try {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Hard error copy when the photo/text belongs to a different analyzer.
 * Returns null when the page matches (or kind is unknown / empty / other).
 */
export function sectionMismatchError(
  section: AnalyzerSection,
  pageKind: AnalyzerPageKind | null,
): string | null {
  if (!pageKind || pageKind === "other" || pageKind === "empty" || pageKind === "mixed") {
    return null;
  }
  if (pageKind === section) return null;

  if (section === "vocabulary") {
    if (pageKind === "grammar") {
      return "This looks like a grammar page. Open Grammar Analyzer instead.";
    }
    if (pageKind === "script") {
      return "This looks like a script or study text. Open Script Analyzer instead.";
    }
  }

  if (section === "grammar") {
    if (pageKind === "vocabulary") {
      return "This looks like a vocabulary page. Open Vocabulary Analyzer instead.";
    }
    if (pageKind === "script") {
      return "This looks like a script or study text. Open Script Analyzer instead.";
    }
  }

  if (section === "script") {
    if (pageKind === "vocabulary") {
      return "This looks like a vocabulary exam page. Open Vocabulary Analyzer instead.";
    }
    if (pageKind === "grammar") {
      return "This looks like a grammar exam page. Open Grammar Analyzer instead.";
    }
  }

  return null;
}
