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

const PAGE_TITLE = "Grammar & ★ Analyzer";

const btnAnalyze =
  "h-11 min-w-[7.5rem] flex-1 gap-2 rounded-xl px-5 text-sm font-medium border border-emerald-600/30 bg-emerald-600 text-white shadow-none transition-colors duration-200 hover:bg-emerald-500 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:flex-none [&_svg:not([class*='size-'])]:size-4";
const btnUtility =
  "h-9 gap-1.5 rounded-lg px-3 text-xs font-medium text-stone-600 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100 [&_svg:not([class*='size-'])]:size-3.5";
const btnUtilityOutline =
  "h-9 gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 shadow-none transition-colors duration-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100 [&_svg:not([class*='size-'])]:size-3.5";

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

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-neutral-800/80 dark:bg-[#0d1117]/90">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-stone-600 transition-all duration-200 hover:bg-stone-100 hover:text-stone-900 sm:h-9 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100"
            >
              ← Decks
            </Link>
            <p className="truncate text-sm font-medium text-stone-900 dark:text-neutral-100">{PAGE_TITLE}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        {geminiReady === false ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950 sm:mb-5 sm:px-4 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            No Gemini API key is set. Add <code className="text-xs">GEMINI_API_KEY</code> to{" "}
            <code className="text-xs">.env.local</code>, then restart the dev server.
          </p>
        ) : null}

        <section className="w-full">
          <div
            className={[
              "w-full overflow-hidden rounded-2xl border shadow-sm transition-colors duration-200 dark:shadow-xl",
              dragging
                ? "border-emerald-400/60 bg-emerald-50/80 dark:border-emerald-500/40 dark:bg-emerald-950/30"
                : "border-stone-200 bg-white dark:border-neutral-800/80 dark:bg-[#0d1117]",
            ].join(" ")}
          >
            <div
              className={[
                "px-4 py-6 text-center transition-colors duration-200 sm:px-6 sm:py-8",
                prepared
                  ? "bg-stone-50/80 dark:bg-[#161b22]"
                  : "border-b border-dashed border-stone-200 dark:border-neutral-800",
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
                <div className="relative mx-auto max-w-full">
                  {/* Local preview of a compressed photo the user just chose. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prepared.previewUrl}
                    alt="Selected grammar page"
                    className={[
                      "mx-auto max-h-48 w-full rounded-xl object-contain transition-opacity sm:max-h-64",
                      analyzing ? "opacity-40" : "",
                    ].join(" ")}
                  />
                  {analyzing ? (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-7 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-medium tracking-tight text-stone-900 dark:text-neutral-100">
                        Analyzing grammar…
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mx-auto grid size-12 place-items-center rounded-xl border border-stone-200 bg-white text-emerald-700 dark:border-neutral-700 dark:bg-[#161b22] dark:text-emerald-400">
                    <ImagePlus className="size-5" />
                  </div>
                  <p className="mt-3.5 text-sm font-medium tracking-tight text-stone-900 dark:text-neutral-100">
                    Drop a grammar / ★ page here
                  </p>
                  <p className="mt-1.5 text-xs text-stone-600 dark:text-neutral-400">JPEG, PNG, or WebP</p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 px-3 py-3 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3.5">
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
                {analyzing ? "Analyzing…" : "Explain"}
              </Button>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          {analyzing && prepared ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-neutral-800 dark:bg-[#161b22]">
              <Loader2 className="size-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-neutral-100">Reading grammar patterns…</p>
                <p lang="my" className="font-myanmar text-xs text-stone-600 dark:text-neutral-400">
                  ခဏစောင့်ပါ — AI က ရှင်းလင်းချက်ရေးနေသည်
                </p>
              </div>
            </div>
          ) : null}
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
            <p className="text-xs font-semibold tracking-wider text-stone-600 uppercase dark:text-neutral-400">
              {questions.length} question{questions.length === 1 ? "" : "s"}
            </p>
            <div className="grid w-full gap-4 sm:gap-5">
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
