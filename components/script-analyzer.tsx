"use client";

import {
  BookmarkPlus,
  Camera,
  ImagePlus,
  Library,
  Loader2,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { GoiDrawer } from "@/components/goi-drawer";
import { ScriptGrammarCard } from "@/components/script-grammar-card";
import { ScriptVocabCard } from "@/components/script-vocab-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDecks } from "@/hooks/use-decks";
import { GeminiKeyNotice, useGeminiStatus } from "@/hooks/use-gemini-status";
import { requestScriptAnalyze, requestScriptAnalyzeImage } from "@/lib/client-script";
import { createDeck } from "@/lib/decks";
import { datedDeckName } from "@/lib/format";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import { scriptGrammarToRows, scriptVocabToRows } from "@/lib/script-to-goi";
import type { ScriptGrammarItem, ScriptVocabItem } from "@/src/constants/scriptPrompt";
import type { VocabRow } from "@/lib/types";

type ResultTab = "vocabulary" | "grammar";
type PreparedScriptImage = { base64: string; previewUrl: string };

const PAGE_TITLE = "Japanese Script Analyzer";
const MAX_SCRIPT_CHARS = 28_000;

const surface =
  "rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-border/50 dark:ring-white/[0.03]";

const btnAnalyze =
  [
    "inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5",
    "border border-primary/30 bg-primary text-sm font-semibold tracking-tight text-primary-foreground",
    "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_12%,transparent),0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
    "transition-all duration-200",
    "hover:bg-primary/92 hover:shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_10%,transparent),0_10px_22px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
    "active:translate-y-px active:scale-[0.985] active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
    "sm:w-auto sm:min-w-[8.5rem]",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" ");

const btnSaveIcon =
  [
    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
    "border border-border/70 bg-card text-foreground shadow-xs",
    "transition-all duration-200",
    "hover:bg-muted/70 hover:text-foreground",
    "active:scale-[0.96]",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" ");

const btnViewGoi =
  [
    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3",
    "border border-border/70 bg-card text-xs font-medium text-foreground shadow-xs",
    "transition-all duration-200",
    "hover:bg-muted/70 active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
    "[&_svg:not([class*='size-'])]:size-3.5",
  ].join(" ");

const btnGhost =
  "h-9 gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-[0.98] dark:hover:bg-white/[0.06] [&_svg:not([class*='size-'])]:size-3.5";

const btnOutline =
  "h-9 gap-1.5 rounded-lg border border-border/70 bg-background/50 px-3 text-xs font-medium text-muted-foreground shadow-none transition-all duration-200 hover:border-border hover:bg-muted/50 hover:text-foreground active:scale-[0.98] dark:border-white/10 dark:hover:bg-white/[0.05] [&_svg:not([class*='size-'])]:size-3.5";

const tabBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45";

function isImageFile(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export function ScriptAnalyzer() {
  const { addDeck, decks, ready } = useDecks();
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [dragging, setDragging] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [prepared, setPrepared] = useState<PreparedScriptImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [goiOpen, setGoiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vocabulary, setVocabulary] = useState<ScriptVocabItem[]>([]);
  const [grammar, setGrammar] = useState<ScriptGrammarItem[]>([]);
  const [tab, setTab] = useState<ResultTab>("vocabulary");
  const geminiReady = useGeminiStatus();

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function takeFile(next: File | null) {
    if (!next) return;
    setError(null);
    setVocabulary([]);
    setGrammar([]);

    try {
      if (!isImageFile(next)) {
        throw new Error("Upload a photo (PNG, JPG, or WebP). Paste text works too.");
      }
      const nextPrepared = await fileToJpegBase64ForJlpt(next);
      setPrepared(nextPrepared);
      setScriptText("");
    } catch (caught) {
      setPrepared(null);
      setError(caught instanceof Error ? caught.message : "This file couldn't be opened.");
    }
  }

  function clearSelection() {
    abortRef.current?.abort();
    setScriptText("");
    setPrepared(null);
    setAnalyzing(false);
    setError(null);
    setVocabulary([]);
    setGrammar([]);
    setDragging(false);
  }

  async function analyze() {
    const trimmed = scriptText.trim();
    if ((!trimmed && !prepared) || analyzing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setVocabulary([]);
    setGrammar([]);
    setAnalyzing(true);
    try {
      const result = prepared
        ? await requestScriptAnalyzeImage(prepared.base64, "image/jpeg", controller.signal)
        : await requestScriptAnalyze(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setVocabulary(result.vocabulary);
      setGrammar(result.grammar);
      setTab(result.vocabulary.length > 0 || result.grammar.length === 0 ? "vocabulary" : "grammar");
      if (result.source === "cache") toast.message("Loaded from cache");
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setVocabulary([]);
      setGrammar([]);
      setError(caught instanceof Error ? caught.message : "The script couldn't be analyzed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  }

  function saveRows(rows: VocabRow[], prefix: string) {
    if (!ready || rows.length === 0) {
      toast.error("No rows could be saved from these results.");
      return false;
    }
    const deck = createDeck({
      name: datedDeckName(prefix),
      rows,
      source: "script",
    });
    addDeck(deck);
    toast.success(`Saved ${rows.length} flashcard${rows.length === 1 ? "" : "s"}`);
    return true;
  }

  function saveCurrentTab() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      if (tab === "vocabulary") {
        saveRows(scriptVocabToRows(vocabulary), "Script Goi");
      } else {
        saveRows(scriptGrammarToRows(grammar), "Script Grammar");
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't save flashcards.");
    } finally {
      setSaving(false);
    }
  }

  function saveOneVocab(item: ScriptVocabItem, index: number) {
    if (!ready || savingKey) return;
    const key = `v-${index}`;
    setSavingKey(key);
    try {
      saveRows(scriptVocabToRows([item]), "Script Goi");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't save flashcard.");
    } finally {
      setSavingKey(null);
    }
  }

  function saveOneGrammar(item: ScriptGrammarItem, index: number) {
    if (!ready || savingKey) return;
    const key = `g-${index}`;
    setSavingKey(key);
    try {
      saveRows(scriptGrammarToRows([item]), "Script Grammar");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't save flashcard.");
    } finally {
      setSavingKey(null);
    }
  }

  const hasResults = vocabulary.length > 0 || grammar.length > 0;
  const canAnalyze = Boolean(prepared) || scriptText.trim().length > 0;
  const hasInput = canAnalyze;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground active:scale-[0.98]"
            >
              ← Decks
            </Link>
            <span className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden />
            <p className="truncate text-sm font-medium tracking-tight">{PAGE_TITLE}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:space-y-5 sm:px-6 sm:pt-7">
        <GeminiKeyNotice />

        <section
          className={[
            surface,
            "overflow-hidden transition-all duration-200",
            dragging ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "",
          ].join(" ")}
        >
          <div
            className={[
              "px-4 py-5 text-center transition-colors duration-200 sm:px-5 sm:py-5",
              hasInput ? "bg-muted/20" : "border-b border-dashed border-border/50",
            ].join(" ")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void takeFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            {prepared ? (
              // Local preview of a compressed photo the user just chose.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prepared.previewUrl}
                alt="Selected script page"
                className="mx-auto max-h-44 w-full rounded-lg border border-border/50 object-contain sm:max-h-52"
              />
            ) : scriptText.trim() ? (
              <div className="text-left">
                <label className="sr-only" htmlFor="script-analyzer-input">
                  Japanese listening script
                </label>
                <Textarea
                  id="script-analyzer-input"
                  value={scriptText}
                  disabled={analyzing}
                  placeholder="男：すみません、駅までの行き方を教えていただけますか。"
                  className="min-h-40 rounded-xl border-border/60 bg-background/80 px-3.5 py-3 text-left text-sm leading-6 shadow-none focus-visible:ring-ring/40 sm:min-h-48"
                  onChange={(event) => {
                    setScriptText(event.target.value.slice(0, MAX_SCRIPT_CHARS));
                    setPrepared(null);
                    setError(null);
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center py-1 sm:py-2">
                <div className="grid size-11 place-items-center rounded-xl border border-border/60 bg-background text-primary transition-transform duration-200">
                  <ScrollText className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium tracking-tight text-foreground">
                  Drop a script photo here
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PNG, JPG, or WebP · or paste text below
                </p>
                <label className="sr-only" htmlFor="script-analyzer-input">
                  Japanese listening script
                </label>
                <Textarea
                  id="script-analyzer-input"
                  value={scriptText}
                  disabled={analyzing}
                  placeholder="Or paste Japanese script text…"
                  className="mt-4 min-h-28 rounded-xl border-border/60 bg-background/80 px-3.5 py-3 text-left text-sm leading-6 shadow-none focus-visible:ring-ring/40"
                  onChange={(event) => {
                    setScriptText(event.target.value.slice(0, MAX_SCRIPT_CHARS));
                    setPrepared(null);
                    setError(null);
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                className={btnOutline}
                disabled={analyzing}
                onClick={() => imageRef.current?.click()}
              >
                <ImagePlus />
                Choose photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className={btnOutline}
                disabled={analyzing}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera />
                Camera
              </Button>
              {hasInput ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={btnGhost}
                  disabled={analyzing}
                  onClick={clearSelection}
                >
                  <X />
                  Clear
                </Button>
              ) : null}
            </div>

            <button
              type="button"
              className={btnAnalyze}
              disabled={!canAnalyze || analyzing || geminiReady !== true}
              onClick={() => void analyze()}
            >
              {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              <span>{analyzing ? "Analyzing…" : "Analyze"}</span>
            </button>
          </div>
        </section>

        {error ? <p className="text-sm leading-6 text-destructive">{error}</p> : null}

        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            void takeFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            void takeFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />

        {analyzing && !hasResults ? (
          <AnalysisSkeleton label="Extracting vocabulary & grammar…" cards={4} variant="vocab-grid" />
        ) : null}

        {hasResults ? (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className={btnViewGoi}
                onClick={() => setGoiOpen(true)}
                aria-label="View saved Goi flashcards"
                title="View saved Goi"
              >
                <Library aria-hidden />
                <span>View Goi</span>
              </button>
              <button
                type="button"
                className={btnSaveIcon}
                disabled={!ready || saving}
                onClick={saveCurrentTab}
                aria-label={saving ? "Saving flashcards" : "Save tab to flashcards"}
                title={tab === "vocabulary" ? "Save vocabulary to flashcards" : "Save grammar to flashcards"}
              >
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <BookmarkPlus aria-hidden />}
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Script analysis results"
              className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/25 p-1 dark:bg-muted/15"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "vocabulary"}
                className={[
                  tabBtn,
                  tab === "vocabulary"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setTab("vocabulary")}
              >
                Vocabulary
                <span className="tabular-nums text-[10px] text-muted-foreground">{vocabulary.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "grammar"}
                className={[
                  tabBtn,
                  tab === "grammar"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                onClick={() => setTab("grammar")}
              >
                Grammar
                <span className="tabular-nums text-[10px] text-muted-foreground">{grammar.length}</span>
              </button>
            </div>

            {tab === "vocabulary" ? (
              vocabulary.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {vocabulary.map((item, index) => (
                    <ScriptVocabCard
                      key={`v-${index}-${item.word}-${item.reading}`}
                      item={item}
                      saving={savingKey === `v-${index}`}
                      onSave={() => saveOneVocab(item, index)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  No vocabulary items were found in this script.
                </p>
              )
            ) : grammar.length > 0 ? (
              <div className="grid gap-3">
                {grammar.map((item, index) => (
                  <ScriptGrammarCard
                    key={`g-${index}-${item.pattern}-${item.reading}`}
                    item={item}
                    saving={savingKey === `g-${index}`}
                    onSave={() => saveOneGrammar(item, index)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                No grammar patterns were found in this script.
              </p>
            )}
          </section>
        ) : null}
      </main>

      <GoiDrawer open={goiOpen} onOpenChange={setGoiOpen} decks={decks} />
    </div>
  );
}
