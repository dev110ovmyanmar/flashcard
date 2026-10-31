"use client";

import { BookmarkPlus, Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { JlptQuestionCard } from "@/components/jlpt-question-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useDecks } from "@/hooks/use-decks";
import { fetchJlptAnalyzeStatus, requestJlptAnalyze } from "@/lib/client-jlpt";
import { createDeck } from "@/lib/decks";
import { datedDeckName } from "@/lib/format";
import { jlptQuestionsToVocabRows } from "@/lib/jlpt-to-goi";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

type PreparedJlptImage = { base64: string; previewUrl: string };

const PAGE_TITLE = "Japanese Vocabulary Analyzer";

const btnAnalyze =
  "h-11 min-w-[7.5rem] flex-1 gap-2 rounded-xl px-5 text-sm font-medium border border-primary/25 bg-primary text-primary-foreground shadow-none transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 dark:border-primary/40 dark:hover:bg-primary/85 sm:flex-none [&_svg:not([class*='size-'])]:size-4";
const btnUtility =
  "h-9 gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted/60 hover:text-foreground dark:hover:bg-white/[0.06] [&_svg:not([class*='size-'])]:size-3.5";
const btnUtilityOutline =
  "h-9 gap-1.5 rounded-lg border border-border/70 bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors duration-200 hover:border-border hover:bg-muted/40 hover:text-foreground dark:border-white/10 dark:hover:bg-white/[0.05] [&_svg:not([class*='size-'])]:size-3.5";
const btnSave =
  "h-11 w-full gap-2 rounded-xl border border-primary/25 bg-primary px-4 text-sm font-medium text-primary-foreground shadow-none transition-colors duration-200 hover:bg-primary/90 sm:w-auto dark:border-primary/40 [&_svg:not([class*='size-'])]:size-4";

export function JlptAnalyzer() {
  const router = useRouter();
  const { addDeck, ready } = useDecks();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PreparedJlptImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<JlptQuestion[]>([]);
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchJlptAnalyzeStatus(controller.signal)
      .then(setGeminiReady)
      .catch(() => setGeminiReady(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function takeFile(next: File | null) {
    if (!next) return;
    setError(null);
    setQuestions([]);
    try {
      const nextPrepared = await fileToJpegBase64ForJlpt(next);
      setPrepared(nextPrepared);
    } catch (caught) {
      setPrepared(null);
      setError(caught instanceof Error ? caught.message : "This photo couldn't be opened.");
    }
  }

  function clearSelection() {
    abortRef.current?.abort();
    setPrepared(null);
    setAnalyzing(false);
    setError(null);
    setQuestions([]);
    setDragging(false);
  }

  async function analyze() {
    if (!prepared || analyzing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setAnalyzing(true);
    try {
      const result = await requestJlptAnalyze(prepared.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      setQuestions(result.questions);
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
      toast.success(
        `Saved ${rows.length} card${rows.length === 1 ? "" : "s"} to Goi (all options)`,
      );
      router.push(`/?deck=${encodeURIComponent(deck.id)}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Couldn't save to Goi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground sm:h-9"
            >
              ← Decks
            </Link>
            <p className="truncate text-sm font-medium">{PAGE_TITLE}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        {geminiReady === false ? (
          <p className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-3 text-sm leading-6 sm:mb-5 sm:px-4">
            No Gemini API key is set. Add <code className="text-xs">GEMINI_API_KEY</code> to{" "}
            <code className="text-xs">.env.local</code>, then restart the dev server.
          </p>
        ) : null}

        <section className="w-full">
          <div
            className={[
              "w-full overflow-hidden rounded-2xl border transition-colors duration-200",
              dragging
                ? "border-primary/50 bg-primary/[0.08]"
                : "border-border/70 bg-card dark:border-white/10 dark:bg-card",
            ].join(" ")}
          >
            <div
              className={[
                "px-4 py-6 text-center transition-colors duration-200 sm:px-6 sm:py-8",
                prepared
                  ? "bg-muted/25 dark:bg-white/[0.03]"
                  : "border-b border-dashed border-border/60 dark:border-white/10",
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
                  alt="Selected exam page"
                  className="mx-auto max-h-48 w-full rounded-xl object-contain sm:max-h-64"
                />
              ) : (
                <>
                  <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border/60 bg-background text-primary dark:border-white/10 dark:bg-white/[0.04]">
                    <ImagePlus className="size-5" />
                  </div>
                  <p className="mt-3.5 text-sm font-medium tracking-tight text-foreground">
                    Drop an image here
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 px-3 py-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  className={btnUtilityOutline}
                  disabled={analyzing}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus />
                  Choose photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={btnUtilityOutline}
                  disabled={analyzing}
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera />
                  Camera
                </Button>
                {prepared ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={btnUtility}
                    disabled={analyzing}
                    onClick={clearSelection}
                  >
                    <X />
                    Clear
                  </Button>
                ) : null}
              </div>

              <Button
                type="button"
                className={btnAnalyze}
                disabled={!prepared || analyzing || geminiReady === false}
                onClick={() => void analyze()}
              >
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {analyzing ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>

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

        {questions.length > 0 ? (
          <section className="mt-6 w-full space-y-4 sm:mt-8">
            <div className="flex justify-end">
              <Button
                type="button"
                className={btnSave}
                disabled={!ready || saving}
                onClick={saveToGoi}
              >
                {saving ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}
                Save all options to Goi
              </Button>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              Saves every choice (正解 + distractors) as flashcards
            </p>
            <div className="grid w-full gap-3 sm:gap-5">
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
    </div>
  );
}
