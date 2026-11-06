/** CJK Unified Ideographs + extensions commonly used in JLPT text. */
export const KANJI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/** Hiragana, katakana, kanji, and common JP connectors. */
const JP_RUN_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶー〜～]+/g;

export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text);
}

export type FuriganaSegment = {
  surface: string;
  /** Hiragana/katakana reading; omit or "" for plain (no hover) spans. */
  reading?: string;
};

/**
 * Parenthesis contents that are exam blanks — not furigana readings.
 * JLPT stems often use （　　） / ( ) / （___） next to kana; those must stay visible.
 */
export function isBlankParenContent(raw: string): boolean {
  const text = raw.trim();
  if (!text) return true;
  return /^[\s\u3000_＿・･…‥.．\-－—─―]+$/u.test(text);
}

/**
 * Parse inline furigana markup into segments.
 * Supports: 漢字《かんじ》, 漢字（かんじ）, 漢字(かんじ), 漢字[かんじ]
 *
 * Parentheses that look like fill-in blanks (empty / spaces / underscores)
 * are kept as literal text so grammar stems do not lose （　　） / ( ).
 */
export function parseFuriganaMarkup(text: string): FuriganaSegment[] {
  const source = text;
  if (!source) return [];

  // Prefer a kanji run before brackets (事故《じこ》), else a kana run
  // for grammar patterns (にかかわらず《にかかわらず》).
  const pattern =
    /(?:([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶ]+)|([ぁ-んァ-ヶー]+))(?:《([^》]*)》|（([^）]*)）|\(([^)]*)\)|\[([^\]]*)\])/g;

  const segments: FuriganaSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const surface = match[1] ?? match[2] ?? "";
    const fromLens = match[3];
    const fromFullParen = match[4];
    const fromHalfParen = match[5];
    const fromSquare = match[6];
    const readingRaw = fromLens ?? fromFullParen ?? fromHalfParen ?? fromSquare ?? "";
    const usedParen = fromFullParen != null || fromHalfParen != null;

    // Blank （　　） / ( ) after kana must not be swallowed as empty furigana.
    if (usedParen && isBlankParenContent(readingRaw)) {
      continue;
    }

    if (match.index > cursor) {
      segments.push({ surface: source.slice(cursor, match.index) });
    }
    const reading = readingRaw.trim();
    if (surface) segments.push({ surface, reading: reading || undefined });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    segments.push({ surface: source.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ surface: source }];
}

/** Pull `surface → reading` pairs from inline 《》 / [] markup into a map. */
export function harvestMarkupReadings(
  text: string,
  target: Record<string, string> = {},
): Record<string, string> {
  if (!text) return target;
  for (const segment of parseFuriganaMarkup(text)) {
    const surface = segment.surface.trim();
    const reading = segment.reading?.trim() ?? "";
    if (surface && reading) {
      target[surface] = reading;
    }
  }
  return target;
}

/**
 * Annotate `text` by replacing known headwords from `readings` (longest-first).
 * Unmatched spans are returned without a reading.
 */
export function applyReadingMap(
  text: string,
  readings: Record<string, string> | null | undefined,
): FuriganaSegment[] {
  return applyAnnotationMap(text, readings, null).map(({ surface, reading }) =>
    reading ? { surface, reading } : { surface },
  );
}

export type AnnotatedSegment = {
  surface: string;
  reading?: string;
  meaning?: string;
  highlight?: boolean;
};

const KANJI_RUN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶ]+/g;

/** Expand a target headword into matchable surfaces (strip markup, kanji runs). */
export function expandHighlightTargets(
  value: string | readonly string[] | null | undefined,
): string[] {
  if (!value) return [];
  const list = typeof value === "string" ? [value] : [...value];
  const out = new Set<string>();

  for (const raw of list) {
    const cleaned = raw.replace(/《[^》]*》/g, "").replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
    if (!cleaned) continue;
    out.add(cleaned);

    const runs = cleaned.match(KANJI_RUN_RE) ?? [];
    for (const run of runs) {
      if (run) out.add(run);
    }

    // Drop trailing kana okurigana: 読む → 読
    const withoutOkurigana = cleaned.replace(/[ぁ-んァ-ヶー]+$/u, "");
    if (withoutOkurigana && withoutOkurigana !== cleaned && hasKanji(withoutOkurigana)) {
      out.add(withoutOkurigana);
    }
  }

  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * Split segments on highlight surfaces, then mark exact / consecutive matches.
 * Handles tokenized stems where 計画 is split as 計 + 画.
 */
export function applyHighlightsToSegments(
  segments: AnnotatedSegment[],
  highlights: string[],
): AnnotatedSegment[] {
  if (highlights.length === 0 || segments.length === 0) return segments;

  const highlightSet = new Set(highlights);
  const splitKeys: Record<string, string> = {};
  for (const surface of highlights) splitKeys[surface] = "1";

  const expanded: AnnotatedSegment[] = [];
  for (const segment of segments) {
    if (highlightSet.has(segment.surface)) {
      expanded.push({ ...segment, highlight: true });
      continue;
    }

    const parts = applyAnnotationMap(segment.surface, null, splitKeys);
    if (parts.length === 1 && parts[0]?.surface === segment.surface) {
      expanded.push({ ...segment, highlight: false });
      continue;
    }

    for (const part of parts) {
      expanded.push({
        surface: part.surface,
        reading: part.surface === segment.surface ? segment.reading : undefined,
        meaning: part.surface === segment.surface ? segment.meaning : undefined,
        highlight: highlightSet.has(part.surface),
      });
    }
  }

  // Mark consecutive surfaces that join to a highlight (e.g. 計 + 画 → 計画).
  const marked = expanded.map((segment) => ({ ...segment, highlight: Boolean(segment.highlight) }));
  let i = 0;
  while (i < marked.length) {
    if (marked[i]?.highlight) {
      i += 1;
      continue;
    }

    let matched = false;
    for (const target of highlights) {
      let acc = "";
      let j = i;
      while (j < marked.length && acc.length < target.length) {
        const next = marked[j];
        if (!next || next.highlight) break;
        acc += next.surface;
        j += 1;
        if (acc === target) {
          for (let k = i; k < j; k += 1) marked[k]!.highlight = true;
          i = j;
          matched = true;
          break;
        }
        if (!target.startsWith(acc)) break;
      }
      if (matched) break;
    }
    if (!matched) i += 1;
  }

  return marked;
}

/**
 * Longest-first split using reading and/or meaning headwords.
 * Surfaces present only in `meanings` still become hover targets.
 */
export function applyAnnotationMap(
  text: string,
  readings: Record<string, string> | null | undefined,
  meanings: Record<string, string> | null | undefined,
): AnnotatedSegment[] {
  const trimmed = text;
  if (!trimmed) return [];

  const readingMap = readings ?? {};
  const meaningMap = meanings ?? {};
  const surfaces = new Set([
    ...Object.keys(readingMap).map((key) => key.trim()).filter(Boolean),
    ...Object.keys(meaningMap).map((key) => key.trim()).filter(Boolean),
  ]);

  if (surfaces.size === 0) return [{ surface: trimmed }];

  const entries = [...surfaces]
    .map((surface) => {
      const reading = readingMap[surface]?.trim() ?? "";
      const meaning = meaningMap[surface]?.trim() ?? "";
      return { surface, reading, meaning };
    })
    .filter((entry) => entry.reading || entry.meaning)
    .sort((a, b) => b.surface.length - a.surface.length);

  if (entries.length === 0) return [{ surface: trimmed }];

  const segments: AnnotatedSegment[] = [];
  let i = 0;

  while (i < trimmed.length) {
    let matched = false;
    for (const entry of entries) {
      if (trimmed.startsWith(entry.surface, i)) {
        segments.push({
          surface: entry.surface,
          reading: entry.reading || undefined,
          meaning: entry.meaning || undefined,
        });
        i += entry.surface.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const start = i;
    i += 1;
    while (i < trimmed.length) {
      const hit = entries.some((entry) => trimmed.startsWith(entry.surface, i));
      if (hit) break;
      i += 1;
    }
    segments.push({ surface: trimmed.slice(start, i) });
  }

  return segments;
}

function hasMarkupChars(text: string): boolean {
  return /《|》|（|）|\[|\]/.test(text) || (/\(/.test(text) && /\)/.test(text) && hasKanji(text));
}

/** Split mixed prose into Japanese runs vs everything else. */
export function splitScriptRuns(text: string): FuriganaSegment[] {
  if (!text) return [];
  const segments: FuriganaSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(JP_RUN_RE.source, "g");

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push({ surface: text.slice(cursor, match.index) });
    }
    segments.push({ surface: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ surface: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ surface: text }];
}

/**
 * Annotate mixed prose (e.g. Burmese + Japanese keywords):
 * 1) honour inline markup 《》 / [] / （）
 * 2) split Japanese runs from surrounding script
 * 3) apply a headword → reading map longest-first inside JP runs
 */
export function annotateProse(
  text: string,
  readings?: Record<string, string> | null,
): FuriganaSegment[] {
  if (!text) return [];

  const base = hasMarkupChars(text) ? parseFuriganaMarkup(text) : [{ surface: text }];
  const hasMarkupReadings = base.some((segment) => Boolean(segment.reading));
  const layers = hasMarkupReadings ? base : [{ surface: text }];

  const out: FuriganaSegment[] = [];
  for (const segment of layers) {
    if (segment.reading) {
      out.push(segment);
      continue;
    }

    for (const run of splitScriptRuns(segment.surface)) {
      if (!hasKanji(run.surface)) {
        out.push(run);
        continue;
      }
      if (readings && Object.keys(readings).length > 0) {
        out.push(...applyReadingMap(run.surface, readings));
      } else {
        out.push(run);
      }
    }
  }

  return out.length > 0 ? out : [{ surface: text }];
}

/** Normalize tokens / markup / reading map into a single segment list. */
export function resolveFuriganaSegments(options: {
  text: string;
  reading?: string | null;
  tokens?: Array<{ surface: string; reading?: string | null }> | null;
  readings?: Record<string, string> | null;
}): FuriganaSegment[] {
  const text = options.text;
  if (!text.trim()) return [{ surface: text || "—" }];

  const map = options.readings ?? null;

  if (options.tokens && options.tokens.length > 0) {
    const resolved: FuriganaSegment[] = [];
    for (const token of options.tokens) {
      const surface = token.surface;
      if (!surface) continue;
      const fromToken = token.reading?.trim() ?? "";
      if (fromToken) {
        resolved.push({ surface, reading: fromToken });
        continue;
      }
      const fromMap = map?.[surface]?.trim() ?? "";
      if (fromMap) {
        resolved.push({ surface, reading: fromMap });
        continue;
      }
      if (map && hasKanji(surface)) {
        const annotated = applyReadingMap(surface, map);
        if (annotated.some((part) => part.reading)) {
          resolved.push(...annotated);
          continue;
        }
      }
      resolved.push({ surface });
    }
    return resolved;
  }

  const reading = options.reading?.trim() ?? "";
  const hasMap = Boolean(map && Object.keys(map).length > 0);

  /**
   * Attach a single `reading` only to the matching kanji run.
   * Mixed prose like `ဥပမာ: 安心။` must NOT become one hover span —
   * pair the reading with `安心` alone.
   */
  const pairReadingOntoKanji = (source: string, yomi: string): FuriganaSegment[] => {
    const runs = splitScriptRuns(source);
    const kanjiIndexes = runs
      .map((run, index) => (hasKanji(run.surface) ? index : -1))
      .filter((index) => index >= 0);

    if (kanjiIndexes.length === 0) return [{ surface: source }];
    if (runs.length === 1) return [{ surface: source, reading: yomi }];
    // Mixed prose (e.g. ဥပမာ: 安心။) — pair onto the sole kanji run only.
    if (kanjiIndexes.length !== 1) return runs;

    const targetIndex = kanjiIndexes[0]!;
    return runs.map((run, index) =>
      index === targetIndex ? { surface: run.surface, reading: yomi } : run,
    );
  };

  // Whole-string reading wins for a single headword (option / target),
  // but mixed Burmese + Japanese must keep the reading paired to the kanji only.
  if (reading && hasKanji(text) && !hasMap && !hasMarkupChars(text)) {
    return pairReadingOntoKanji(text, reading);
  }

  if (hasMap || hasMarkupChars(text) || hasKanji(text)) {
    const annotated = annotateProse(text, map);
    if (!reading || !hasKanji(text)) return annotated;

    const unpairedKanjiIndexes = annotated
      .map((segment, index) =>
        hasKanji(segment.surface) && !segment.reading?.trim() ? index : -1,
      )
      .filter((index) => index >= 0);

    if (unpairedKanjiIndexes.length === 0) return annotated;

    // Whole-string match (single headword) or exactly one unpaired kanji run.
    if (annotated.length === 1 && unpairedKanjiIndexes[0] === 0) {
      return [{ surface: text, reading }];
    }
    if (unpairedKanjiIndexes.length === 1) {
      const target = unpairedKanjiIndexes[0]!;
      return annotated.map((segment, index) =>
        index === target ? { surface: segment.surface, reading } : segment,
      );
    }

    return annotated;
  }

  if (reading && hasKanji(text)) {
    return pairReadingOntoKanji(text, reading);
  }

  return [{ surface: text }];
}
