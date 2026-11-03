"use client";

import { BookmarkPlus, Library, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalyzerInputMode } from "@/components/analyzer-input-mode";
import { AnalyzerInputPanel } from "@/components/analyzer-input-panel";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { GoiDrawer } from "@/components/goi-drawer";
import { JlptQuestionCard } from "@/components/jlpt-question-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDecks } from "@/hooks/use-decks";
import { GeminiKeyNotice, useGeminiStatus } from "@/hooks/use-gemini-status";
import { requestJlptAnalyze, requestJlptAnalyzeText } from "@/lib/client-jlpt";
import { createDeck } from "@/lib/decks";
import { datedDeckName } from "@/lib/format";
import { jlptQuestionsToVocabRows } from "@/lib/jlpt-to-goi";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

type PreparedJlptImage = { base64: string; previewUrl: string };

const PAGE_TITLE = "Japanese Vocabulary Analyzer";
const MAX_TEXT_CHARS = 28_000;

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

export function JlptAnalyzer() {
  const { addDeck, decks, ready } = useDecks();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputMode, setInputMode] = useState<AnalyzerInputMode>("image");
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PreparedJlptImage | null>(null);
  const [textInput, setTextInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goiOpen, setGoiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<JlptQuestion[]>([]);
  const geminiReady = useGeminiStatus();

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function takeFile(next: File | null) {
    if (!next) return;
    setError(null);
    setQuestions([]);
    setTextInput("");
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
    setQuestions([]);
    setDragging(false);
    if (next === "image") {
      setTextInput("");
    } else {
      setPrepared(null);
    }
    setInputMode(next);
  }

  function clearSelection() {
    abortRef.current?.abort();
    setPrepared(null);
    setTextInput("");
    setAnalyzing(false);
    setError(null);
    setQuestions([]);
    setDragging(false);
  }

  async function analyze() {
    const trimmed = textInput.trim();
    const usingText = inputMode === "text";
    if (usingText ? !trimmed : !prepared) return;
    if (analyzing) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setQuestions([]);
    setAnalyzing(true);
    try {
      const result = usingText
        ? await requestJlptAnalyzeText(trimmed, controller.signal)
        : await requestJlptAnalyze(prepared!.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      setQuestions(result.questions);
      if (result.source === "cache") toast.message("Loaded from cache");
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setQuestions([]);
      setError(caught instanceof Error ? caught.message : "The exam paper couldn't be analyzed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  }

  function saveToGoi() {
    if (!ready || saving || questions.length === 0) return;
    const rows = jlptQuestionsToVocabRows(questions);
    if (rows.length === 0) {
      toast.error("No vocabulary rows could be saved from these results.");
      return;
    }
    setSaving(true);
    try {
      const deck = createDeck({
        name: datedDeckName("Goi"),
        rows,
        source: "jlpt",
      });
      addDeck(deck);
      toast.success(`Saved ${rows.length} flashcard${rows.length === 1 ? "" : "s"}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't save flashcards.");
    } finally {
      setSaving(false);
    }
  }

  const hasResults = questions.length > 0;
  const canAnalyze = inputMode === "text" ? textInput.trim().length > 0 : Boolean(prepared);

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

        <AnalyzerInputPanel
          mode={inputMode}
          onModeChange={switchMode}
          analyzing={analyzing}
          canAnalyze={canAnalyze}
          geminiReady={geminiReady === true}
          dragging={dragging}
          prepared={prepared}
          textInput={textInput}
          maxTextChars={MAX_TEXT_CHARS}
          imageHint="PNG, JPG, or WebP · Mondai 1–6"
          imageAlt="Selected exam page"
          textTitle="Paste or type vocabulary text"
          textHint=""
          textPlaceholder={"問題4\n1 彼の話はあまりにも_____ので、誰も信じなかった。\n1 現実的　2 非現実的　3 積極的　4 消極的"}
          textareaId="jlpt-text-input"
          onTextChange={(value) => {
            setTextInput(value);
            setPrepared(null);
            setError(null);
            setQuestions([]);
          }}
          onPickFile={() => fileRef.current?.click()}
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
          ref={fileRef}
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
          <AnalysisSkeleton label="Reading the vocabulary page…" cards={3} />
        ) : null}

        {hasResults ? (
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Results
                </p>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                  {questions.length} question{questions.length === 1 ? "" : "s"}
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
                  onClick={saveToGoi}
                  aria-label={saving ? "Saving flashcards" : "Save to flashcard"}
                  title="Save to flashcard"
                >
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : <BookmarkPlus aria-hidden />}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {questions.map((question) => (
                <JlptQuestionCard
                  key={`${question.mondai_type}-${question.question_number}-${question.japanese_sentence}`}
                  question={question}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <GoiDrawer open={goiOpen} onOpenChange={setGoiOpen} decks={decks} />
    </div>
  );
}
