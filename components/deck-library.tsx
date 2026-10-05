"use client";

import { motion } from "framer-motion";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { deckStats } from "@/lib/decks";
import { formatUpdated, sourceLabel } from "@/lib/format";
import { SAMPLE_DECK_ID } from "@/lib/sample-data";
import type { Deck } from "@/lib/types";

export function DeckLibrary({
  decks,
  geminiConfigured,
  onScan,
  onType,
  onFile,
  onStudy,
  onEdit,
  onDelete,
  onRestoreSample,
}: {
  decks: Deck[];
  geminiConfigured: boolean | null;
  onScan: () => void;
  onType: () => void;
  onFile: (file: File) => void;
  onStudy: (id: string) => void;
  onEdit: (deck: Deck) => void;
  onDelete: (id: string) => void;
  onRestoreSample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Deck | null>(null);
  const ordered = [...decks].sort((a, b) => b.updatedAt - a.updatedAt);
  const hasSample = decks.some((deck) => deck.id === SAMPLE_DECK_ID);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
      <section className="grid items-stretch gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <div className="flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.18em] text-primary uppercase">Vocabulary desk</p>
          <h1 className="mt-2 max-w-xl text-[2rem] leading-[1.08] font-semibold tracking-tight sm:mt-3 sm:text-5xl sm:leading-[1.05]">
            A textbook page, turned into cards you can flip.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted-foreground sm:mt-4 sm:text-base sm:leading-7">
            Photograph a Japanese list — kanji, hiragana, and the Myanmar meaning. Check the reading, then study with the card face-down until the word stays.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:gap-3">
            <Button type="button" className="h-12 rounded-full px-4 sm:h-11 sm:px-5" onClick={onScan}>
              <ImagePlus />
              Scan a page
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-full bg-card/70 px-4 sm:h-11 sm:px-5" onClick={onType}>
              <Plus />
              Type a deck
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {geminiConfigured === null
              ? "Checking the reader…"
              : geminiConfigured
                ? "Gemini is connected and will read the photo."
                : "Practice mode: scans open an editable N2 page until a Gemini API key is added."}
          </p>
        </div>

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
          className={`glass hidden cursor-pointer rounded-[1.75rem] p-5 text-left transition-colors lg:block ${dragging ? "border-primary" : ""}`}
        >
          <div className="rounded-2xl border border-border/80 bg-paper px-4 py-4">
            <div className="grid grid-cols-[1.1fr_1fr_1.2fr] gap-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              <span>Kanji</span>
              <span>Reading</span>
              <span>Myanmar</span>
            </div>
            <div className="mt-3 space-y-3">
              <Specimen kanji="経験" reading="けいけん" meaning="အတွေ့အကြုံ" />
              <Specimen kanji="経済" reading="けいざい" meaning="စီးပွားရေး" />
              <Specimen kanji="環境" reading="かんきょう" meaning="ပတ်ဝန်းကျင်" />
            </div>
          </div>
          <p className="mt-4 text-sm font-medium">Drop a textbook photo here</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Rows like these become cards. The front shows only the kanji.
          </p>
        </button>

        <button
          type="button"
          onClick={onScan}
          className="card-wash rounded-[1.75rem] border border-border px-4 py-7 text-center shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--foreground)_35%,transparent)] lg:hidden"
        >
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Front of the card</p>
          <p lang="ja" className="mt-2 font-serif text-6xl leading-none tracking-tight">
            経験
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Photograph a page like this</p>
        </button>
      </section>

      <section className="mt-8 lg:mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">On your desk</h2>
            <p className="text-sm text-muted-foreground">Decks stay in this browser.</p>
          </div>
        </div>

        {ordered.length === 0 ? (
          <div className="mt-4 rounded-[1.75rem] border border-dashed border-border px-6 py-12 text-center">
            <p className="text-base font-medium">Your desk is clear.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Scan a page or type a few words. The N2 sample can come back if you want a deck to practice on.
            </p>
            {!hasSample ? (
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onRestoreSample}>
                Put the N2 sample back
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ordered.map((deck, index) => {
              const stats = deckStats(deck);
              const lead = deck.cards[0]?.kanji ?? "文";
              return (
                <motion.li
                  key={deck.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04, type: "spring", stiffness: 260, damping: 26 }}
                  className="glass flex flex-col rounded-[1.5rem] p-4"
                >
                  <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => onStudy(deck.id)}>
                    <span lang="ja" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper font-serif text-2xl">
                      {Array.from(lead).slice(0, 2).join("")}
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
                    <p className="min-w-0 truncate text-xs text-muted-foreground">{formatUpdated(deck.updatedAt)}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${deck.name}`} onClick={() => onEdit(deck)}>
                        <Pencil />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${deck.name}`} onClick={() => setPendingDelete(deck)}>
                        <Trash2 />
                      </Button>
                      <Button type="button" size="sm" className="h-10 rounded-full px-4 sm:h-8" onClick={() => onStudy(deck.id)}>
                        Study
                      </Button>
                    </div>
                  </div>
                </motion.li>
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
              The cards and their review history leave this browser. This does not affect any other device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
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

function Specimen({ kanji, reading, meaning }: { kanji: string; reading: string; meaning: string }) {
  return (
    <div className="grid grid-cols-[1.1fr_1fr_1.2fr] items-baseline gap-2 border-t border-border/70 pt-3">
      <span lang="ja" className="font-serif text-xl">
        {kanji}
      </span>
      <span lang="ja" className="font-serif text-sm text-muted-foreground">
        {reading}
      </span>
      <span lang="my" className="font-myanmar text-sm leading-6">
        {meaning}
      </span>
    </div>
  );
}
