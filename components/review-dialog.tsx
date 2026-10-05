"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { blankRows } from "@/lib/decks";
import type { VocabRow } from "@/lib/types";

export function ReviewDialog({
  open,
  title,
  description,
  banner,
  rawText,
  initialName,
  initialRows,
  editing,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  banner?: string;
  rawText?: string;
  initialName: string;
  initialRows: VocabRow[];
  editing: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (action: "study" | "later", name: string, rows: VocabRow[]) => void;
}) {
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<VocabRow[]>(initialRows);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  function update(id: string, patch: Partial<VocabRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : blankRows(1);
    });
  }

  function save(action: "study" | "later") {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Name this deck.");
      return;
    }
    const filled = rows.filter((row) => row.kanji.trim() || row.reading.trim() || row.meaning.trim());
    if (filled.length === 0) {
      setFormError("Add at least one card.");
      return;
    }
    const missing = filled.filter((row) => !row.kanji.trim() || !row.reading.trim() || !row.meaning.trim());
    if (missing.length) {
      setInvalid(new Set(missing.map((row) => row.id)));
      setFormError("Each card needs kanji, a reading, and a Myanmar meaning — or clear the row.");
      return;
    }
    setInvalid(new Set());
    setFormError(null);
    onSave(
      action,
      trimmedName,
      filled.map((row) => ({
        ...row,
        kanji: row.kanji.trim(),
        reading: row.reading.trim(),
        meaning: row.meaning.trim(),
      })),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,880px)] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {banner ? (
            <p className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground">
              {banner}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="deck-name">Deck name</Label>
            <Input
              id="deck-name"
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const bad = invalid.has(row.id);
              return (
                <div
                  key={row.id}
                  className={`rounded-2xl border bg-card/70 p-3 ${bad ? "border-destructive" : "border-border"}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Card {index + 1}</p>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove card ${index + 1}`} onClick={() => remove(row.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor={`${row.id}-kanji`} className="text-xs text-muted-foreground">
                        Kanji
                      </Label>
                      <Input
                        id={`${row.id}-kanji`}
                        lang="ja"
                        value={row.kanji}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-serif text-lg md:text-lg"
                        onChange={(event) => update(row.id, { kanji: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${row.id}-reading`} className="text-xs text-muted-foreground">
                        Hiragana
                      </Label>
                      <Input
                        id={`${row.id}-reading`}
                        lang="ja"
                        value={row.reading}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-serif md:text-base"
                        onChange={(event) => update(row.id, { reading: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <Label htmlFor={`${row.id}-meaning`} className="text-xs text-muted-foreground">
                        Myanmar
                      </Label>
                      <Textarea
                        id={`${row.id}-meaning`}
                        lang="my"
                        value={row.meaning}
                        rows={2}
                        spellCheck={false}
                        className="min-h-9 font-myanmar text-base leading-7 md:text-base"
                        onChange={(event) => update(row.id, { meaning: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" className="rounded-full" onClick={() => setRows((current) => [...current, ...blankRows(1)])}>
            <Plus />
            Add a card
          </Button>

          {rawText ? (
            <details className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">Text the scan returned</summary>
              <pre className="mt-3 max-h-40 overflow-auto font-sans text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
                {rawText}
              </pre>
            </details>
          ) : null}

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-background px-5 py-4">
          {editing ? (
            <Button type="button" className="rounded-full" onClick={() => save("later")}>
              Save changes
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => save("later")}>
                Save for later
              </Button>
              <Button type="button" className="rounded-full" onClick={() => save("study")}>
                Save and study
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
