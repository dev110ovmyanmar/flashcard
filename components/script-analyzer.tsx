"use client";

import { BookmarkPlus, Library, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalyzerInputMode } from "@/components/analyzer-input-mode";
import { AnalyzerInputPanel } from "@/components/analyzer-input-panel";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { AnalyzerPageHeader } from "@/components/analyzer-page-header";
import { GoiDrawer } from "@/components/goi-drawer";
import { ScriptGrammarCard } from "@/components/script-grammar-card";
import { ScriptVocabCard } from "@/components/script-vocab-card";
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

const PAGE_TITLE = "Script";
const MAX_SCRIPT_CHARS = 28_000;

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

const tabBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45";

export function ScriptAnalyzer() {
  const { addDeck, decks, ready } = useDecks();
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputMode, setInputMode] = useState<AnalyzerInputMode>("image");
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
    setScriptText("");
    setInputMode("image");

    try {
      const nextPrepared = await fileToJpegBase64ForJlpt(next);
      setPrepared(nextPrepared);
    } catch (caught) {
      setPrepared(null);
      setError(caught instanceof Error ? caught.message : "This photo couldn't be opened.");
    }
  }

  function switchMode(next: AnalyzerInputMode) {
    if (next === inputMode) return;
    abortRef.current?.abort();
    setAnalyzing(false);
    setError(null);
    setVocabulary([]);
    setGrammar([]);
    setDragging(false);
    if (next === "image") {
      setScriptText("");
    } else {
      setPrepared(null);
    }
    setInputMode(next);
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
    const usingText = inputMode === "text";
    if (usingText ? !trimmed : !prepared) return;
    if (analyzing) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setVocabulary([]);
    setGrammar([]);
    setAnalyzing(true);
    try {
      const result = usingText
        ? await requestScriptAnalyze(trimmed, controller.signal)
        : await requestScriptAnalyzeImage(prepared!.base64, "image/jpeg", controller.signal);
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
  const canAnalyze = inputMode === "text" ? scriptText.trim().length > 0 : Boolean(prepared);
  const resultCount = tab === "vocabulary" ? vocabulary.length : grammar.length;
  const resultLabel =
    tab === "vocabulary"
      ? `${resultCount} word${resultCount === 1 ? "" : "s"}`
      : `${resultCount} pattern${resultCount === 1 ? "" : "s"}`;

  return (
    <div className="flex min-h-full flex-col">
      <AnalyzerPageHeader title={PAGE_TITLE} />

      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-5 pb-6 sm:space-y-5 sm:px-6 sm:pt-7 sm:pb-8">
        <GeminiKeyNotice />

        <AnalyzerInputPanel
          mode={inputMode}
          onModeChange={switchMode}
          analyzing={analyzing}
          canAnalyze={canAnalyze}
          geminiReady={geminiReady === true}
          dragging={dragging}
          prepared={prepared}
          textInput={scriptText}
          maxTextChars={MAX_SCRIPT_CHARS}
          imageHint="PNG, JPG, or WebP · Listening script"
          imageAlt="Selected script page"
          textTitle="Paste or type script text"
          textHint="Listening script dialogue / narration"
          textPlaceholder={"男：すみません、駅までの行き方を教えていただけますか。\n女：はい。この道をまっすぐ行って、二つ目の信号を右に曲がってください。"}
          textareaId="script-analyzer-input"
          onTextChange={(value) => {
            setScriptText(value);
            setPrepared(null);
            setError(null);
            setVocabulary([]);
            setGrammar([]);
          }}
          onPickFile={() => imageRef.current?.click()}
          onPickCamera={() => cameraRef.current?.click()}
          onClear={clearSelection}
          onAnalyze={() => void analyze()}
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
        />

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
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Results
                </p>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                  {resultLabel}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
