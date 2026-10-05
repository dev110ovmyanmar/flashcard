import type { Deck } from "@/lib/types";

export function formatUpdated(ts: number, now = Date.now()): string {
  const delta = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Updated just now";
  if (delta < hour) {
    const minutes = Math.floor(delta / minute);
    return `Updated ${minutes} min ago`;
  }
  if (delta < day) {
    const hours = Math.floor(delta / hour);
    return `Updated ${hours} hr ago`;
  }
  if (delta < 14 * day) {
    const days = Math.floor(delta / day);
    return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }
  return `Updated ${new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function sourceLabel(deck: Deck): string {
  if (deck.source === "sample") return "Sample";
  if (deck.source === "manual") return "Typed";
  if (deck.scanMode === "mock") return "Practice scan";
  return "Scanned";
}

export function datedDeckName(prefix: string, now = new Date()): string {
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${prefix} · ${label}`;
}
