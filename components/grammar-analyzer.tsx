"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalyzerInputMode } from "@/components/analyzer-input-mode";
import { AnalyzerInputPanel } from "@/components/analyzer-input-panel";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { GrammarQuestionCard } from "@/components/grammar-question-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { GeminiKeyNotice, useGeminiStatus } from "@/hooks/use-gemini-status";
import { requestGrammarAnalyze, requestGrammarAnalyzeText } from "@/lib/client-grammar";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import type { GrammarQuestion } from "@/src/constants/grammarPrompt";

type PreparedGrammarImage = { base64: string; previewUrl: string };

const PAGE_TITLE = "Japanese Grammar Analyzer";
const MAX_TEXT_CHARS = 28_000;

export function GrammarAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputMode, setInputMode] = useState<AnalyzerInputMode>("image");
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PreparedGrammarImage | null>(null);
  const [textInput, setTextInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
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
        ? await requestGrammarAnalyzeText(trimmed, controller.signal)
        : await requestGrammarAnalyze(prepared!.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      setQuestions(result.questions);
      if (result.source === "cache") toast.message("Loaded from cache");
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setQuestions([]);
      setError(caught instanceof Error ? caught.message : "The grammar page couldn't be analyzed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
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
          imageHint="PNG, JPG, or WebP · Grammar / ★"
          imageAlt="Selected grammar page"
          textTitle="Paste or type grammar text"
          textHint="Grammar / ★ questions with options"
          textPlaceholder={"1\n彼は忙しい_____、いつも笑顔で対応してくれる。\n1. にもかかわらず\n2. にかかわらず\n3. にせよ\n4. とはいえ"}
          textareaId="grammar-text-input"
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
          <AnalysisSkeleton label="Reading the grammar page…" cards={3} />
        ) : null}

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
