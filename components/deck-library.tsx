"use client";

import {
  BookOpenText,
  ImagePlus,
  Layers,
  Loader2,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGeminiStatus } from "@/hooks/use-gemini-status";
import { cardFace, deckStats } from "@/lib/decks";
import { formatUpdated, sourceLabel } from "@/lib/format";
import type { Deck } from "@/lib/types";

/** Shared surface language — soft border, whisper shadow (Notion / Linear). */
const surfaceCard =
  "rounded-2xl border border-border/50 bg-card/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-border/40 dark:bg-card/60 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]";

const modePill =
  [
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5",
    "text-sm font-medium whitespace-nowrap text-muted-foreground",
    "transition-all duration-200",
    "hover:bg-background hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    "active:scale-[0.98]",
    "[&_svg:not([class*='size-'])]:size-3.5",
  ].join(" ");

export function DeckLibrary({
  decks,
  onScan,
  onType,
  onFile,
  onStudy,
  onEdit,
  onDelete,
}: {
  decks: Deck[];
  onScan: () => void;
  onType: () => void;
  onFile: (file: File) => void;
  onStudy: (id: string) => void;
  onEdit: (deck: Deck) => void;
  onDelete: (id: string) => void;
}) {
  const geminiConfigured = useGeminiStatus();
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Deck | null>(null);
  const ordered = [...decks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-6 sm:px-6 sm:py-10">
      {/* Mode selector + hero scanner — generous vertical rhythm */}
      <section className="flex flex-col gap-8 sm:gap-10">
        {/* Desktop / tablet: mode pills */}
        <nav
          aria-label="Study modes"
          className={[
            surfaceCard,
            "hidden flex-wrap items-center justify-start gap-1 px-2 py-1.5 sm:flex",
          ].join(" ")}
        >
          <button type="button" className={modePill} onClick={onType}>
            <Plus aria-hidden />
            Type a deck
          </button>
          <Link href="/jlpt-analyzer" className={modePill}>
            <Sparkles aria-hidden />
            Vocabulary
          </Link>
          <Link href="/grammar-analyzer" className={modePill}>
            <BookOpenText aria-hidden />
            Grammar
          </Link>
          <Link href="/script-analyzer" className={modePill}>
            <ScrollText aria-hidden />
            Script
          </Link>
        </nav>

        {/* Primary scan hero — single entry for drop / browse */}
        <button
          type="button"
          onClick={onScan}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
          className={[
            "group w-full rounded-2xl border border-dashed p-6 text-center sm:p-8",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
            dragging
              ? "border-primary/45 bg-primary/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              : [
                  "border-border/60 bg-muted/10",
                  "hover:border-neutral-300 hover:bg-neutral-50/50",
                  "dark:hover:border-border dark:hover:bg-muted/25",
                  "shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
                ].join(" "),
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto grid size-12 place-items-center rounded-xl border bg-card text-primary",
              "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200 sm:size-14",
              dragging
                ? "border-primary/30"
                : "border-border/50 group-hover:border-neutral-300 dark:group-hover:border-border",
            ].join(" ")}
          >
            <ImagePlus className="size-5" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
            Scan a page
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-[13px]">
            Drop a photo here, or tap to browse files
          </p>
          {geminiConfigured === null ? (
            <p className="mx-auto mt-3 flex items-center justify-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Checking AI setup…
            </p>
          ) : geminiConfigured === false ? (
            <p className="mx-auto mt-3 max-w-sm text-[11px] leading-5 text-muted-foreground">
              Add <code className="text-[11px]">GEMINI_API_KEY</code> to enable photo reading.
            </p>
          ) : null}
        </button>
      </section>

      <section className="mt-10 sm:mt-12">
        {ordered.length === 0 ? (
          <div className={[surfaceCard, "p-6 text-center sm:p-8"].join(" ")}>
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border/50 bg-muted/25 text-muted-foreground sm:size-14">
              <Layers className="size-5" aria-hidden />
            </div>
            <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
              No decks yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Drop a page into the scanner above, or create a deck by typing. Your Goi stays on this
              device until you export a backup.
            </p>
            {/* Secondary path only — no duplicate Scan CTA */}
            <button
              type="button"
              onClick={onType}
              className="mt-6 text-sm font-medium text-foreground underline-offset-4 transition-colors duration-200 hover:text-primary hover:underline"
            >
              Create first deck
            </button>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {ordered.map((deck, index) => {
              const stats = deckStats(deck);
              const leadCard = deck.cards[0];
              const lead = (leadCard ? cardFace(leadCard) : "") || "文";
              const leadSurface = Array.from(lead).slice(0, 2).join("");
              const leadReading =
                leadCard?.kanji.trim() && leadSurface && leadCard.kanji.includes(leadSurface)
                  ? leadCard.reading
                  : leadCard?.kanji.trim() === leadSurface
                    ? leadCard.reading
                    : "";
              return (
                <li
                  key={deck.id}
                  className={[
                    surfaceCard,
                    "flex flex-col p-6 transition-shadow duration-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => onStudy(deck.id)}
                  >
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted/40 font-serif text-2xl">
                      <FuriganaHover
                        text={leadSurface}
                        reading={leadReading}
                        focusable={false}
                        className="font-serif text-2xl leading-none"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{deck.name}</h3>
                        <Badge variant="outline">{sourceLabel(deck)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stats.total} cards · {stats.remembered} remembered
                        {stats.weak > 0 ? ` · ${stats.weak} to review` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-moss"
                      style={{ width: `${stats.total ? (stats.remembered / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      {formatUpdated(deck.updatedAt)}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${deck.name}`}
                        onClick={() => onEdit(deck)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${deck.name}`}
                        onClick={() => setPendingDelete(deck)}
                      >
                        <Trash2 />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-xl px-4 sm:h-8"
                        onClick={() => onStudy(deck.id)}
                      >
                        Study
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              The cards and their review history leave this browser. This does not affect any other
              device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setPendingDelete(null)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete deck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
