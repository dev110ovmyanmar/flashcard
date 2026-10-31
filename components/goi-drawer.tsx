"use client";

import { ArrowLeft, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cardFace, deckStats } from "@/lib/decks";
import { formatUpdated, sourceLabel } from "@/lib/format";
import type { Deck } from "@/lib/types";

/**
 * In-app Goi / flashcard list for PWA — bottom sheet on mobile, dialog on desktop.
 * Never opens a new tab; overlays the current analyzer page.
 */
export function GoiDrawer({
  open,
  onOpenChange,
  decks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: Deck[] | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...(decks ?? [])].sort((a, b) => b.updatedAt - a.updatedAt),
    [decks],
  );

  const selected = selectedId ? ordered.find((deck) => deck.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="gap-0 overflow-hidden p-0 max-sm:max-h-[min(90dvh,100%)] sm:max-w-lg sm:max-h-[min(85dvh,720px)]"
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border/60 px-5 py-4 pr-14 text-left">
          {selected ? (
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0 rounded-lg"
                aria-label="Back to Goi list"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <DialogTitle className="truncate">{selected.name}</DialogTitle>
                <DialogDescription className="mt-1">
                  {selected.cards.length} card{selected.cards.length === 1 ? "" : "s"} ·{" "}
                  {sourceLabel(selected)}
                </DialogDescription>
              </div>
            </div>
          ) : (
            <>
              <DialogTitle>Saved Goi</DialogTitle>
              <DialogDescription>
                Flashcards saved on this device · close anytime to return to analysis
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {selected ? (
            <ul className="space-y-2 pb-2">
              {selected.cards.map((card) => {
                const face = cardFace(card) || "—";
                return (
                  <li
                    key={card.id}
                    className="rounded-xl border border-border/55 bg-muted/20 px-3.5 py-3 dark:bg-muted/10"
                  >
                    <p className="font-serif text-[1.15rem] leading-7 tracking-tight text-foreground">
                      <FuriganaHover
                        text={face}
                        reading={card.reading}
                        focusable={false}
                        className="font-serif"
                      />
                    </p>
                    {card.reading && card.kanji.trim() ? (
                      <p className="mt-0.5 font-sans text-xs tracking-[0.04em] text-muted-foreground">
                        {card.reading}
                      </p>
                    ) : null}
                    <p
                      lang="my"
                      className="mt-1.5 font-myanmar text-[13px] leading-6 text-muted-foreground"
                    >
                      {card.meaning.trim() || "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : ordered.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="grid size-12 place-items-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
                <Layers className="size-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">No saved Goi yet</p>
              <p className="mt-1.5 max-w-[16rem] text-xs leading-5 text-muted-foreground">
                Use the bookmark button on your analysis results to save vocabulary here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 pb-2">
              {ordered.map((deck) => {
                const stats = deckStats(deck);
                const lead = deck.cards[0];
                const face = lead ? cardFace(lead) : "文";
                return (
                  <li key={deck.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3 text-left shadow-xs transition-colors duration-150 hover:bg-muted/40 active:scale-[0.995] dark:hover:bg-white/[0.04]"
                      onClick={() => setSelectedId(deck.id)}
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/40 font-serif text-xl">
                        <FuriganaHover
                          text={Array.from(face).slice(0, 2).join("") || "文"}
                          reading={lead?.reading}
                          focusable={false}
                          className="font-serif text-xl leading-none"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {deck.name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {sourceLabel(deck)}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {stats.total} cards
                          {stats.weak > 0 ? ` · ${stats.weak} to review` : ""}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                          {formatUpdated(deck.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
