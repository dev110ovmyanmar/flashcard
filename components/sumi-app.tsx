"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeckLibrary } from "@/components/deck-library";
import { DeskFallback } from "@/components/desk-fallback";
import { ReviewDialog } from "@/components/review-dialog";
import { ScanDialog, type ScanDialogHandle } from "@/components/scan-dialog";
import { SiteHeader } from "@/components/site-header";
import { StudySession } from "@/components/study-session";
import { Button } from "@/components/ui/button";
import { useDecks } from "@/hooks/use-decks";
import { fetchVisionStatus } from "@/lib/client-ocr";
import { blankRows, createDeck, mergeDeck, withIds } from "@/lib/decks";
import { datedDeckName } from "@/lib/format";
import { createSampleDeck } from "@/lib/sample-data";
import type { Card, DeckSource, OcrSuccess, ScanMode, VocabRow } from "@/lib/types";

type ReviewState = {
  mode: "create" | "edit";
  deckId?: string;
  name: string;
  rows: VocabRow[];
  banner?: string;
  rawText?: string;
  source: DeckSource;
  scanMode?: ScanMode;
};

export function SumiApp() {
  const router = useRouter();
  const search = useSearchParams();
  const deckId = search.get("deck");
  const { decks, ready, corrupt, addDeck, saveDeck, deleteDeck, gradeCard, restoreCard, startFresh } = useDecks();
  const [scanOpen, setScanOpen] = useState(false);
  const scanRef = useRef<ScanDialogHandle>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [vision, setVision] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchVisionStatus(controller.signal)
      .then(setVision)
      .catch(() => setVision(false));
    return () => controller.abort();
  }, []);

  const active = decks?.find((deck) => deck.id === deckId) ?? null;

  function openStudy(id: string) {
    router.push(`/?deck=${encodeURIComponent(id)}`);
  }

  function closeStudy() {
    router.push("/");
  }

  function openScan() {
    scanRef.current?.reset();
    setScanOpen(true);
  }

  function openManual() {
    setReview({
      mode: "create",
      name: datedDeckName("New deck"),
      rows: blankRows(3),
      source: "manual",
      banner: "Type the kanji, the hiragana reading, and the Myanmar meaning. Empty rows are ignored.",
    });
  }

  function openEdit(deckIdToEdit: string) {
    const deck = decks?.find((item) => item.id === deckIdToEdit);
    if (!deck) return;
    setReview({
      mode: "edit",
      deckId: deck.id,
      name: deck.name,
      rows: deck.cards.map((card) => ({
        id: card.id,
        kanji: card.kanji,
        reading: card.reading,
        meaning: card.meaning,
      })),
      source: deck.source,
      scanMode: deck.scanMode,
      banner: "Edits keep the review history for cards you don't replace.",
    });
  }

  function handleScanResult(result: OcrSuccess) {
    setScanOpen(false);
    scanRef.current?.reset();
    const rows = result.rows.length ? withIds(result.rows) : blankRows(1);
    setReview({
      mode: "create",
      name: datedDeckName(result.source === "mock" ? "Practice page" : "Scanned page"),
      rows,
      banner: result.message,
      rawText: result.rawText,
      source: "scan",
      scanMode: result.source,
    });
  }

  function handleSave(action: "study" | "later", name: string, rows: VocabRow[]) {
    if (!review) return;
    if (review.mode === "edit" && review.deckId) {
      const existing = decks?.find((deck) => deck.id === review.deckId);
      if (!existing) return;
      const next = mergeDeck(existing, name, rows);
      saveDeck(next);
      setReview(null);
      toast.success(`Saved ${next.name}`);
      if (action === "study") openStudy(next.id);
      return;
    }
    const deck = createDeck({
      name,
      rows,
      source: review.source,
      scanMode: review.scanMode,
    });
    addDeck(deck);
    setReview(null);
    toast.success(`Saved ${deck.name} · ${deck.cards.length} cards`);
    if (action === "study") openStudy(deck.id);
  }

  function handleGrade(cardId: string, grade: "easy" | "hard") {
    if (!active) return;
    gradeCard(active.id, cardId, grade);
  }

  function handleRestore(card: Card) {
    if (!active) return;
    restoreCard(active.id, card);
  }

  if (!ready || !decks) return <DeskFallback />;

  return (
    <div className="min-h-dvh">
      <SiteHeader title={active?.name} onBack={deckId ? closeStudy : undefined} />
      {corrupt ? (
        <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-destructive/30 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm">Saved decks could not be read in this browser.</p>
          <Button type="button" size="sm" className="rounded-full" onClick={startFresh}>
            Start fresh
          </Button>
        </div>
      ) : null}

      {deckId && active ? (
        <StudySession key={active.id} deck={active} onGrade={handleGrade} onRestoreCard={handleRestore} />
      ) : deckId && !active ? (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">That deck is not on this desk.</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted in this browser.</p>
          <Button type="button" className="mt-6 rounded-full" onClick={closeStudy}>
            Back to decks
          </Button>
        </div>
      ) : (
        <DeckLibrary
          decks={decks}
          visionConfigured={vision}
          onScan={openScan}
          onType={openManual}
          onFile={(file) => {
            setScanOpen(true);
            scanRef.current?.read(file);
          }}
          onStudy={openStudy}
          onEdit={(deck) => openEdit(deck.id)}
          onDelete={deleteDeck}
          onRestoreSample={() => {
            const sample = createSampleDeck();
            addDeck(sample);
            toast.success("N2 core is back on your desk");
          }}
        />
      )}

      <ScanDialog
        ref={scanRef}
        open={scanOpen}
        visionConfigured={vision}
        onOpenChange={setScanOpen}
        onResult={handleScanResult}
      />

      <ReviewDialog
        key={review ? `${review.mode}-${review.deckId ?? review.name}` : "closed"}
        open={Boolean(review)}
        title={review?.mode === "edit" ? "Edit cards" : "Check the cards"}
        description={
          review?.mode === "edit"
            ? "Correct a reading or a meaning before the next session."
            : "Nothing is saved until you keep this list."
        }
        banner={review?.banner}
        rawText={review?.rawText}
        initialName={review?.name ?? ""}
        initialRows={review?.rows ?? []}
        editing={review?.mode === "edit"}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
