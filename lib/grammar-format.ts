export type IncorrectReasonItem = {
  /** Option number / label, e.g. "2" or "ア". */
  option: string;
  /** Optional grammar fragment shown with the option, e.g. "わけだ". */
  pattern: string;
  /** Burmese (or mixed) explanation body — why it does not fit. */
  body: string;
  /** Japanese example sentence showing real usage of this distractor pattern. */
  example: string;
};

export type GrammarStemOption = {
  /** Display number / kana label without trailing dot, e.g. "1" or "ア". */
  label: string;
  /** Option surface text (may include 《furigana》). */
  text: string;
};

export type GrammarQuestionParts = {
  stem: string;
  options: GrammarStemOption[];
};

/**
 * Split questionText into stem + choices.
 * Handles jammed one-liners like "1 にもかかわらず 2 にかかわらず 3 にせよ 4 とはいえ"
 * and already-numbered lines like "1. にもかかわらず".
 */
export function splitGrammarQuestionText(raw: string): GrammarQuestionParts {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { stem: "", options: [] };

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { stem: "", options: [] };

  // Trailing one-option-per-line block: "1. …" / "2. …"
  let trailingStart = lines.length;
  while (trailingStart > 0 && isSingleOptionLine(lines[trailingStart - 1]!)) {
    trailingStart -= 1;
  }
  if (lines.length - trailingStart >= 2) {
    const options = parseOptionsBlob(lines.slice(trailingStart).join("\n"));
    if (options.length >= 2) {
      return {
        stem: lines.slice(0, trailingStart).join("\n").trim(),
        options,
      };
    }
  }

  // Prefer a dedicated jammed options line ("1 a 2 b 3 c 4 d").
  let stemLines = [...lines];
  let optionBlob = "";

  const optionLineIndexes: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (looksLikeJammedOptionsLine(lines[i]!)) optionLineIndexes.push(i);
  }

  if (optionLineIndexes.length > 0) {
    const firstOpt = optionLineIndexes[0]!;
    if (firstOpt > 0) {
      stemLines = lines.slice(0, firstOpt);
      optionBlob = lines.slice(firstOpt).join("\n");
    } else if (lines.length === 1) {
      return splitStemAndOptionsOnOneLine(lines[0]!);
    } else {
      optionBlob = lines.join("\n");
      stemLines = [];
    }
  } else if (lines.length === 1) {
    return splitStemAndOptionsOnOneLine(lines[0]!);
  }

  const options = parseOptionsBlob(optionBlob);
  if (options.length >= 2) {
    return { stem: stemLines.join("\n").trim(), options };
  }

  // Fallback: try the last line alone.
  if (lines.length >= 2) {
    const last = lines[lines.length - 1]!;
    const fromLast = parseOptionsBlob(last);
    if (fromLast.length >= 2) {
      return { stem: lines.slice(0, -1).join("\n").trim(), options: fromLast };
    }
  }

  return { stem: text, options: [] };
}

function isSingleOptionLine(line: string): boolean {
  return /^(?:\d+[.)．]?|[ア-エ])\s+\S/u.test(line.trim());
}

function looksLikeJammedOptionsLine(line: string): boolean {
  const hits = line.match(/(?:^|[\s　])(?:\d+[.)．]?\s*|[ア-エ]\s*)\S/gu);
  return Boolean(hits && hits.length >= 2);
}

function splitStemAndOptionsOnOneLine(line: string): GrammarQuestionParts {
  // Find the first " 1 " / "1." / " ア " that starts a choice run of 2+.
  const candidates = [...line.matchAll(/(?:^|[\s　])(\d+)[.)．]?(?=[\s　]?\S)|(?:^|[\s　])([ア-エ])(?=[\s　]?\S)/gu)];
  for (const match of candidates) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    const start = match[0].startsWith(" ") || match[0].startsWith("　") ? index + 1 : index;
    const blob = line.slice(start).trim();
    const options = parseOptionsBlob(blob);
    if (options.length >= 2) {
      return { stem: line.slice(0, start).trim(), options };
    }
  }
  const options = parseOptionsBlob(line);
  if (options.length >= 2) return { stem: "", options };
  return { stem: line, options: [] };
}

function parseOptionsBlob(blob: string): GrammarStemOption[] {
  const text = blob.trim();
  if (!text) return [];

  // Already one-option-per-line with numbers.
  const lineItems = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lineItems.length >= 2 && lineItems.every((line) => /^(?:\d+[.)．]?|[ア-エ])\s+\S/u.test(line))) {
    return lineItems.map((line) => {
      const m = line.match(/^(\d+|[ア-エ])[.)．]?\s*(.+)$/u);
      return { label: (m?.[1] ?? "").trim(), text: (m?.[2] ?? line).trim() };
    }).filter((item) => item.label && item.text);
  }

  // Jammed: "1 にもかかわらず 2 にかかわらず 3 にせよ 4 とはいえ"
  const parts = text
    .split(/(?=(?:^|[\s　])(?:\d+[.)．]?|[ア-エ])(?=[\s　]?\S))/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const items: GrammarStemOption[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+|[ア-エ])[.)．]?\s*(.+)$/u);
    if (!m) continue;
    const label = (m[1] ?? "").trim();
    const optionText = (m[2] ?? "").trim();
    if (label && optionText) items.push({ label, text: optionText });
  }
  return items.length >= 2 ? items : [];
}

/**
 * Markers that introduce a Japanese usage example after a Burmese reason.
 * Accepts correct ဥပမာ, Latin-p garbles (ဥpမာ), and 例 / 例文.
 */
const EXAMPLE_MARKER_RE =
  /(?:\|\s*)?(?:ဥ[ပpP]မာ(?:\s*အသုံး)?|例(?:文)?)\s*[：:]\s*/u;

const EXAMPLE_ONLY_LINE_RE =
  /^(?:ဥ[ပpP]မာ(?:\s*အသုံး)?|例(?:文)?)\s*[：:]\s*(.+)$/u;

/** Pull trailing example usage out of a distractor explanation body. */
export function splitIncorrectReasonBody(raw: string): { body: string; example: string } {
  const text = raw.trim();
  if (!text) return { body: "", example: "" };

  const match = text.match(
    new RegExp(`^(.*?)\\s*${EXAMPLE_MARKER_RE.source}(.+)$`, "su"),
  );
  if (match) {
    return {
      body: (match[1] ?? "").trim(),
      example: (match[2] ?? "").trim(),
    };
  }
  return { body: text, example: "" };
}

/**
 * Split Gemini's incorrectReasonsBurmese into per-option items for micro-cards.
 * Accepts lines like "• 2 わけだ: …", "3 ようだ — …", or jammed "• 2 … • 3 …".
 * Optional trailing "ဥပမာ: …" / "例: …" becomes the example field.
 */
export function parseIncorrectReasonItems(raw: string): IncorrectReasonItem[] {
  const text = raw.trim();
  if (!text) return [];

  let chunks = text
    .split(/\n+/)
    .map((line) => line.replace(/^[•●・\-–*]\s*/, "").trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    chunks = text
      .split(/(?:•|●|・|(?=(?:^|[\s])\d+\s+\S))/u)
      .map((chunk) => chunk.replace(/^[•●・\-–*]\s*/, "").trim())
      .filter(Boolean);
  }

  const items: IncorrectReasonItem[] = [];
  for (const chunk of chunks) {
    // Orphan example line from a prior option (common when the model wraps).
    const orphanExample = chunk.match(EXAMPLE_ONLY_LINE_RE);
    if (orphanExample) {
      const last = items[items.length - 1];
      if (last && !last.example) {
        last.example = (orphanExample[1] ?? "").trim();
      }
      continue;
    }

    // Allow 語《よみ》 inside the pattern (e.g. にかかわらず《にかかわらず》)
    const match = chunk.match(
      /^(\d+|[ア-オカ-コA-Da-d])\s*(?:[)）]\s*)?([^\n—:\-：]{0,80}?)?\s*[—:\-：]\s*([\s\S]+)$/u,
    );
    if (match) {
      const split = splitIncorrectReasonBody((match[3] ?? "").trim());
      items.push({
        option: match[1] ?? "",
        pattern: (match[2] ?? "").trim(),
        body: split.body,
        example: split.example,
      });
      continue;
    }

    const loose = chunk.match(/^(\d+|[ア-オカ-コA-Da-d])\s+([\s\S]+)$/u);
    if (loose) {
      const rest = (loose[2] ?? "").trim();
      const headed = rest.match(/^(\S{1,24})\s+[—:\-：]\s*([\s\S]+)$/u);
      const split = splitIncorrectReasonBody((headed?.[2] ?? rest).trim());
      items.push({
        option: loose[1] ?? "",
        pattern: headed?.[1]?.trim() ?? "",
        body: split.body,
        example: split.example,
      });
    }
  }

  return items;
}

/** Display label like "2 わけだ" or just "2". */
export function incorrectReasonHeading(item: IncorrectReasonItem): string {
  return [item.option, item.pattern].filter(Boolean).join(" ").trim();
}
