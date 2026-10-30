"use client";

import { motion } from "framer-motion";
import { BookOpenText, Download, ImagePlus, Layers, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { downloadGoiBackup, readBackupFile } from "@/lib/backup";
import { cardFace, deckStats } from "@/lib/decks";
import { formatUpdated, sourceLabel } from "@/lib/format";
import type { Deck, PersistedState } from "@/lib/types";

const primaryBtn =
  "inline-flex h-10 w-auto shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-all duration-200 border border-primary/20 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm active:scale-[0.98] [&_svg:not([class*='size-'])]:size-4";

const toolbarBtn =
  "inline-flex h-9 w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border border-border/70 bg-card/80 text-muted-foreground shadow-xs hover:border-border hover:bg-muted/50 hover:text-foreground active:scale-[0.98] dark:bg-card/40 [&_svg:not([class*='size-'])]:size-3.5";

const toolbarIconBtn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-muted-foreground shadow-xs transition-all duration-200 hover:border-border hover:bg-muted/50 hover:text-foreground active:scale-[0.98] dark:bg-card/40 [&_svg:not([class*='size-'])]:size-3.5";

export function DeckLibrary({
  decks,
  geminiConfigured,
  onScan,
  onType,
  onFile,
  onStudy,
  onEdit,
  onDelete,
  onImportBackup,
}: {
  decks: Deck[];
  geminiConfigured: boolean | null;
  onScan: () => void;
  onType: () => void;
  onFile: (file: File) => void;
  onStudy: (id: string) => void;
  onEdit: (deck: Deck) => void;
  onDelete: (id: string) => void;
  onImportBackup: (state: PersistedState) => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Deck | null>(null);
  const [pendingImport, setPendingImport] = useState<PersistedState | null>(null);
  const ordered = [...decks].sort((a, b) => b.updatedAt - a.updatedAt);

  function exportBackup() {
    try {
      downloadGoiBackup();
      toast.success("Goi backup downloaded");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't export the backup.");
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    try {
      const state = await readBackupFile(file);
      setPendingImport(state);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't read that backup.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
      <section className="flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <Button type="button" className={primaryBtn} onClick={onScan}>
            <ImagePlus />
            Scan a page
          </Button>

          <div
            role="toolbar"
            aria-label="Desk actions"
            className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/25 p-1.5 dark:bg-muted/15"
          >
            <Button type="button" variant="ghost" className={toolbarBtn} onClick={onType}>
              <Plus />
              Type a deck
            </Button>
            <Link href="/jlpt-analyzer" className={toolbarBtn}>
              <Sparkles />
              Vocabulary analyzer
            </Link>
            <Link href="/grammar-analyzer" className={toolbarBtn}>
              <BookOpenText />
              Grammar analyzer
            </Link>
            <span className="mx-0.5 hidden h-5 w-px bg-border/80 sm:block" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              className={toolbarIconBtn}
              aria-label="Export JSON backup"
              title="Export JSON"
              onClick={exportBackup}
            >
              <Download />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={toolbarIconBtn}
              aria-label="Import JSON backup"
              title="Import JSON"
              onClick={() => importRef.current?.click()}
            >
              <Upload />
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        {geminiConfigured === false ? (
          <p className="-mt-2 text-xs text-muted-foreground sm:-mt-4">
            Add <code className="text-[11px]">GEMINI_API_KEY</code> to enable photo reading.
          </p>
        ) : null}

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
            "group w-full rounded-xl border border-dashed px-5 py-12 text-center transition-all duration-200 sm:px-8 sm:py-14",
            dragging
              ? "border-primary/50 bg-primary/[0.08] shadow-xs"
              : "border-border/70 bg-muted/15 hover:border-primary/35 hover:bg-muted/30",
          ].join(" ")}
        >
          <div
            className={[
              "mx-auto grid size-14 place-items-center rounded-xl border bg-card text-primary shadow-xs transition-colors duration-200",
              dragging ? "border-primary/30" : "border-border/60 group-hover:border-primary/25",
            ].join(" ")}
          >
            <ImagePlus className="size-5" />
          </div>
          <p className="mt-4 text-sm font-semibold tracking-tight text-foreground">Drop a photo here</p>
          <p className="mt-1.5 text-xs text-muted-foreground">or tap to choose an image</p>
        </button>
      </section>

      <section className="mt-10 sm:mt-12">
        {ordered.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/60 px-6 py-14 text-center shadow-xs sm:px-10 sm:py-16">
            <div className="mx-auto grid size-14 place-items-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
              <Layers className="size-5" />
            </div>
            <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
              No decks yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Start with a scanned page or type a few words. Your Goi stays on this device until you export a backup.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" className={primaryBtn} onClick={onScan}>
                <ImagePlus />
                Create
              </Button>
              <Button type="button" variant="ghost" className={toolbarBtn} onClick={onType}>
                <Plus />
                Type instead
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {ordered.map((deck, index) => {
              const stats = deckStats(deck);
              const lead = (deck.cards[0] ? cardFace(deck.cards[0]) : "") || "文";
              return (
                <motion.li
                  key={deck.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04, type: "spring", stiffness: 260, damping: 26 }}
                  className="flex flex-col rounded-xl border border-border/70 bg-card p-4 shadow-xs ring-1 ring-black/[0.02] dark:ring-white/[0.03]"
                >
                  <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => onStudy(deck.id)}>
                    <span
                      lang="ja"
                      className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted/40 font-serif text-2xl"
                    >
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
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setPendingDelete(null)}>
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

      <Dialog open={Boolean(pendingImport)} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle>Restore Goi backup?</DialogTitle>
            <DialogDescription>
              This replaces all decks currently saved in this browser with{" "}
              {pendingImport ? pendingImport.decks.length : 0} deck
              {pendingImport?.decks.length === 1 ? "" : "s"} from the JSON file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                if (!pendingImport) return;
                onImportBackup(pendingImport);
                setPendingImport(null);
                toast.success("Goi backup restored");
              }}
            >
              Replace & restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
