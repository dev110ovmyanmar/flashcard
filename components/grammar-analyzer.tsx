"use client";

import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GrammarQuestionCard } from "@/components/grammar-question-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { fetchGrammarAnalyzeStatus, requestGrammarAnalyze } from "@/lib/client-grammar";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import type { GrammarQuestion } from "@/src/constants/grammarPrompt";

type PreparedGrammarImage = { base64: string; previewUrl: string };

const PAGE_TITLE = "Japanese Grammar Analyzer";

const surface =
  "rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-border/50 dark:ring-white/[0.03]";

/** Primary CTA — Analyze */
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

const btnGhost =
  "h-9 gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-[0.98] dark:hover:bg-white/[0.06] [&_svg:not([class*='size-'])]:size-3.5";

const btnOutline =
  "h-9 gap-1.5 rounded-lg border border-border/70 bg-background/50 px-3 text-xs font-medium text-muted-foreground shadow-none transition-all duration-200 hover:border-border hover:bg-muted/50 hover:text-foreground active:scale-[0.98] dark:border-white/10 dark:hover:bg-white/[0.05] [&_svg:not([class*='size-'])]:size-3.5";

export function GrammarAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PreparedGrammarImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchGrammarAnalyzeStatus(controller.signal)
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
      const result = await requestGrammarAnalyze(prepared.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      setQuestions(result.questions);
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setQuestions([]);
      setError(caught instanceof Error ? caught.message : "The grammar page couldn't be analyzed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  }

  const hasResults = questions.length > 0;

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
        {geminiReady === false ? (
          <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6">
            No Gemini API key is set. Add <code className="text-xs">GEMINI_API_KEY</code> to{" "}
            <code className="text-xs">.env.local</code>, then restart the dev server.
          </p>
        ) : null}

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
              prepared ? "bg-muted/20" : "border-b border-dashed border-border/50",
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
                alt="Selected grammar page"
                className="mx-auto max-h-44 w-full rounded-lg border border-border/50 object-contain sm:max-h-52"
              />
            ) : (
              <div className="flex flex-col items-center py-1 sm:py-2">
                <div className="grid size-11 place-items-center rounded-xl border border-border/60 bg-background text-primary transition-transform duration-200">
                  <ImagePlus className="size-5" />
                </div>
                <p className="mt-3 text-sm font-medium tracking-tight text-foreground">
                  Drop an image here
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PNG, JPG, or WebP · Grammar / ★
                </p>
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
                onClick={() => fileRef.current?.click()}
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
              {prepared ? (
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
              disabled={!prepared || analyzing || geminiReady === false}
              onClick={() => void analyze()}
            >
              {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              <span>{analyzing ? "Analyzing…" : "Analyze"}</span>
            </button>
          </div>
        </section>

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

        {hasResults ? (
          <section className="space-y-3 sm:space-y-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Results
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                {questions.length} question{questions.length === 1 ? "" : "s"}
              </h2>
            </div>

            <div className="grid gap-3">
              {questions.map((question, index) => (
                <GrammarQuestionCard
                  key={`${question.questionNumber}-${index}-${question.grammarPattern}`}
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
