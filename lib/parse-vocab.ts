import type { ParsedRow } from "@/lib/types";

export type WordBox = {
  text: string;
  x: number;
  y: number;
  h: number;
};

const HEADER_WORDS = new Set([
  "単語",
  "漢字",
  "意味",
  "読み",
  "読み方",
  "例文",
  "番号",
  "日本語",
  "語彙",
  "ページ",
  "ミャンマー語",
]);

type Script = "kanji" | "hiragana" | "katakana" | "choon" | "other";

function scriptOf(ch: string): Script {
  const code = ch.codePointAt(0) ?? 0;
  if (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    ch === "々" ||
    ch === "〆"
  ) {
    return "kanji";
  }
  if (code >= 0x3040 && code <= 0x309f) return "hiragana";
  if (code >= 0x30a0 && code <= 0x30ff) return "katakana";
  if (ch === "ー") return "choon";
  return "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseVocabLine(line: string): ParsedRow | null {
  let text = line.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u3000/g, " ").trim();
  text = text.replace(/^[0-9０-９]{1,3}(?:\s*[.、．)\]】:：\-])?\s+/, "");
  text = text.replace(/[（）()【】「」『』]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const meaning = (text.match(/[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]+/g) ?? []).join("");
  const japanese = text.replace(/[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]/g, " ");
  const { words, readings } = tokenizeJapanese(japanese);

  if (isHeaderLine(words, readings, meaning)) return null;

  let kanji = words[0] ?? "";
  let reading = readings.join("");

  if (kanji && !reading) {
    const glued = kanji.match(/^([\u4E00-\u9FFF々]{2,8})([\u3040-\u309F]{3,})$/);
    if (glued) {
      kanji = glued[1];
      reading = glued[2];
    }
  }

  if (!kanji && readings.length && meaning) {
    kanji = readings[0];
    reading = readings[0];
  }

  if (!kanji && !reading && !meaning) return null;
  return { kanji, reading, meaning };
}

function isHeaderLine(words: string[], readings: string[], meaning: string): boolean {
  if (meaning || readings.length) return false;
  return words.length > 0 && words.every((word) => HEADER_WORDS.has(word));
}

function tokenizeJapanese(input: string): { words: string[]; readings: string[] } {
  const chars = Array.from(input);
  const words: string[] = [];
  const readings: string[] = [];
  let index = 0;

  while (index < chars.length) {
    const script = scriptOf(chars[index]);
    if (script === "other" || script === "choon") {
      index += 1;
      continue;
    }

    if (script === "kanji") {
      let word = chars[index];
      index += 1;
      while (index < chars.length) {
        const next = scriptOf(chars[index]);
        if (next === "kanji" || next === "hiragana" || next === "katakana" || next === "choon") {
          word += chars[index];
          index += 1;
        } else {
          break;
        }
      }
      words.push(word);
      continue;
    }

    let run = chars[index];
    const kind = script;
    index += 1;
    while (index < chars.length) {
      const next = scriptOf(chars[index]);
      if (next === kind || next === "choon") {
        run += chars[index];
        index += 1;
      } else {
        break;
      }
    }
    readings.push(run);
  }

  return { words, readings };
}

export function parseVocabLines(lines: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const state: { pending: ParsedRow | null } = { pending: null };

  const take = (row: ParsedRow | null) => {
    if (row && row.kanji.trim()) rows.push(row);
  };

  for (const raw of lines) {
    const parsed = parseVocabLine(raw);
    if (!parsed) continue;

    const onlyMeaning = !parsed.kanji && !parsed.reading && parsed.meaning.length > 0;
    const onlyReading = !parsed.kanji && parsed.reading.length > 0 && parsed.meaning.length === 0;
    const onlyKanji = parsed.kanji.length > 0 && parsed.reading.length === 0 && parsed.meaning.length === 0;
    const held = state.pending;

    if (onlyMeaning && held && held.meaning.length === 0) {
      take({ kanji: held.kanji, reading: held.reading, meaning: parsed.meaning });
      state.pending = null;
      continue;
    }

    if (onlyReading && held && held.reading.length === 0) {
      state.pending = { kanji: held.kanji, reading: parsed.reading, meaning: held.meaning };
      continue;
    }

    if (onlyKanji) {
      take(held);
      state.pending = parsed;
      continue;
    }

    take(held);
    if (parsed.kanji && parsed.reading && parsed.meaning) {
      rows.push(parsed);
      state.pending = null;
    } else if (parsed.kanji) {
      state.pending = parsed;
    } else {
      state.pending = null;
    }
  }

  take(state.pending);
  return dedupe(rows).slice(0, 80);
}

function dedupe(rows: ParsedRow[]): ParsedRow[] {
  const unique: ParsedRow[] = [];
  for (const row of rows) {
    const previous = unique[unique.length - 1];
    if (
      previous &&
      previous.kanji === row.kanji &&
      previous.reading === row.reading &&
      previous.meaning === row.meaning
    ) {
      continue;
    }
    unique.push(row);
  }
  return unique;
}

export function wordsToLines(words: WordBox[]): string[] {
  if (words.length === 0) return [];
  const heights = words.map((word) => word.h).filter((height) => height > 0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 16;
  const threshold = Math.max(8, median * 0.65);
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; words: WordBox[] }[] = [];

  for (const word of sorted) {
    let best: { y: number; words: WordBox[] } | null = null;
    let bestDistance = Infinity;
    for (const line of lines) {
      const distance = Math.abs(line.y - word.y);
      if (distance < threshold && distance < bestDistance) {
        best = line;
        bestDistance = distance;
      }
    }
    if (!best) {
      lines.push({ y: word.y, words: [word] });
      continue;
    }
    best.words.push(word);
    best.y = best.words.reduce((sum, item) => sum + item.y, 0) / best.words.length;
  }

  return lines
    .sort((a, b) => a.y - b.y)
    .map((line) =>
      line.words
        .sort((a, b) => a.x - b.x)
        .map((word) => word.text)
        .join(" "),
    );
}

export function rowsFromVision(payload: unknown): { rows: ParsedRow[]; rawText: string; error?: string } {
  if (!isRecord(payload)) return { rows: [], rawText: "" };
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return { rows: [], rawText: "", error: payload.error.message };
  }

  const responses = Array.isArray(payload.responses) ? payload.responses : [];
  const first = responses.find(isRecord);
  if (!first) return { rows: [], rawText: "" };
  if (isRecord(first.error) && typeof first.error.message === "string") {
    return { rows: [], rawText: "", error: first.error.message };
  }

  const annotation = isRecord(first.fullTextAnnotation) ? first.fullTextAnnotation : null;
  const rawText = annotation && typeof annotation.text === "string" ? annotation.text : "";
  const boxes = annotation ? collectWords(annotation) : [];
  const fromBoxes = boxes.length ? parseVocabLines(wordsToLines(boxes)) : [];
  const fromText = rawText ? parseVocabLines(rawText.split(/\r?\n/)) : [];
  const rows = fromBoxes.length >= fromText.length ? fromBoxes : fromText;
  return { rows, rawText };
}

function collectWords(annotation: Record<string, unknown>): WordBox[] {
  const pages = Array.isArray(annotation.pages) ? annotation.pages : [];
  const words: WordBox[] = [];

  for (const page of pages) {
    if (!isRecord(page) || !Array.isArray(page.blocks)) continue;
    for (const block of page.blocks) {
      if (!isRecord(block) || !Array.isArray(block.paragraphs)) continue;
      for (const paragraph of block.paragraphs) {
        if (!isRecord(paragraph) || !Array.isArray(paragraph.words)) continue;
        for (const word of paragraph.words) {
          if (!isRecord(word)) continue;
          const text = wordText(word).trim();
          if (!text) continue;
          const box = wordBox(word);
          if (!box) continue;
          words.push({ text, ...box });
        }
      }
    }
  }

  return words;
}

function wordText(word: Record<string, unknown>): string {
  if (!Array.isArray(word.symbols)) return "";
  let text = "";
  for (const symbol of word.symbols) {
    if (isRecord(symbol) && typeof symbol.text === "string") text += symbol.text;
  }
  return text;
}

function wordBox(word: Record<string, unknown>): { x: number; y: number; h: number } | null {
  const box = isRecord(word.boundingBox) ? word.boundingBox : null;
  if (!box) return null;
  const vertices = Array.isArray(box.vertices)
    ? box.vertices
    : Array.isArray(box.normalizedVertices)
      ? box.normalizedVertices
      : null;
  if (!vertices || vertices.length === 0) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const vertex of vertices) {
    if (!isRecord(vertex)) continue;
    xs.push(Number(vertex.x ?? 0));
    ys.push(Number(vertex.y ?? 0));
  }
  if (xs.length === 0 || ys.length === 0) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const height = Math.max(0.001, maxY - minY);
  return { x: minX, y: minY + height / 2, h: height };
}
