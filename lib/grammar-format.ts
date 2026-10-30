export type IncorrectReasonItem = {
  /** Option number / label, e.g. "2" or "ア". */
  option: string;
  /** Optional grammar fragment shown with the option, e.g. "わけだ". */
  pattern: string;
  /** Burmese (or mixed) explanation body. */
  body: string;
};

/**
 * Split Gemini's incorrectReasonsBurmese into per-option items for micro-cards.
 * Accepts lines like "• 2 わけだ: …", "3 ようだ — …", or jammed "• 2 … • 3 …".
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
    const match = chunk.match(
      /^(\d+|[ア-オカ-コA-Da-d])\s*(?:[)）]\s*)?([^\n—:\-：]{0,40}?)?\s*[—:\-：]\s*([\s\S]+)$/u,
    );
    if (match) {
      items.push({
        option: match[1] ?? "",
        pattern: (match[2] ?? "").trim(),
        body: (match[3] ?? "").trim(),
      });
      continue;
    }

    const loose = chunk.match(/^(\d+|[ア-オカ-コA-Da-d])\s+([\s\S]+)$/u);
    if (loose) {
      const rest = (loose[2] ?? "").trim();
      const split = rest.match(/^(\S{1,24})\s+[—:\-：]\s*([\s\S]+)$/u);
      items.push({
        option: loose[1] ?? "",
        pattern: split?.[1]?.trim() ?? "",
        body: (split?.[2] ?? rest).trim(),
      });
    }
  }

  return items;
}

/** Display label like "2 わけだ" or just "2". */
export function incorrectReasonHeading(item: IncorrectReasonItem): string {
  return [item.option, item.pattern].filter(Boolean).join(" ").trim();
}
