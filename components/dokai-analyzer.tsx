"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnalyzerInputMode } from "@/components/analyzer-input-mode";
import { AnalyzerInputPanel } from "@/components/analyzer-input-panel";
import { AnalysisSkeleton } from "@/components/analysis-skeleton";
import { AnalyzerPageHeader } from "@/components/analyzer-page-header";
import { DokaiQuestionCard } from "@/components/dokai-question-card";
import { FuriganaHover } from "@/components/furigana-hover";
import { Button } from "@/components/ui/button";
import { GeminiKeyNotice, useGeminiStatus } from "@/hooks/use-gemini-status";
import { requestDokaiAnalyzeImage, requestDokaiAnalyzeText } from "@/lib/client-dokai";
import { harvestMarkupReadings } from "@/lib/furigana";
import { fileToJpegBase64ForJlpt } from "@/lib/prepare-image";
import type { DokaiGlossaryEntry, DokaiQuestion } from "@/src/constants/dokaiPrompt";
import { UI } from "@/src/constants/uiCopy";

type PreparedDokaiImage = { base64: string; previewUrl: string };

const PAGE_TITLE = UI.page.dokai;
const MAX_TEXT_CHARS = 28_000;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function DokaiAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [inputMode, setInputMode] = useState<AnalyzerInputMode>("image");
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PreparedDokaiImage | null>(null);
  const [textInput, setTextInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [passageText, setPassageText] = useState("");
  const [summaryBurmese, setSummaryBurmese] = useState("");
  const [intentBurmese, setIntentBurmese] = useState("");
  const [glossary, setGlossary] = useState<DokaiGlossaryEntry[]>([]);
  const [questions, setQuestions] = useState<DokaiQuestion[]>([]);

  const geminiReady = useGeminiStatus();

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function takeFile(next: File | null) {
    if (!next) return;
    setError(null);
    clearResults();
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

  function clearResults() {
    setPassageText("");
    setSummaryBurmese("");
    setIntentBurmese("");
    setGlossary([]);
    setQuestions([]);
  }

  function switchMode(next: AnalyzerInputMode) {
    if (next === inputMode) return;
    abortRef.current?.abort();
    setAnalyzing(false);
    setError(null);
    clearResults();
    setDragging(false);
    if (next === "image") setTextInput("");
    else setPrepared(null);
    setInputMode(next);
  }

  function clearSelection() {
    abortRef.current?.abort();
    setPrepared(null);
    setTextInput("");
    setAnalyzing(false);
    setError(null);
    clearResults();
    setDragging(false);
  }

  function startNewAnalysis() {
    clearSelection();
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
    clearResults();
    setAnalyzing(true);
    try {
      const result = usingText
        ? await requestDokaiAnalyzeText(trimmed, controller.signal)
        : await requestDokaiAnalyzeImage(prepared!.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      setPassageText(result.passage_text);
      setSummaryBurmese(result.summary_burmese);
      setIntentBurmese(result.intent_burmese);
      setGlossary(Array.isArray(result.glossary) ? result.glossary : []);
      setQuestions(result.questions);
      if (result.source === "cache") toast.message(UI.results.cacheLoaded);
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      clearResults();
      setError(caught instanceof Error ? caught.message : "The reading page couldn't be analyzed.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  }

  const hasResults = Boolean(passageText || summaryBurmese || intentBurmese || questions.length);
  const showInput = !hasResults;
  const canAnalyze = inputMode === "text" ? textInput.trim().length > 0 : Boolean(prepared);
  const passageReadings = useMemo(() => {
    const map: Record<string, string> = {};
    harvestMarkupReadings(passageText, map);
    for (const entry of glossary) {
      const surface = entry.surface.trim();
      const reading = entry.reading.trim();
      if (surface && reading) map[surface] = reading;
    }
    return map;
  }, [passageText, glossary]);

  const passageMeanings = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of glossary) {
      const surface = entry.surface.trim();
      const meaning = entry.meaning_burmese.trim();
      if (surface && meaning) map[surface] = meaning;
    }
    return map;
  }, [glossary]);

  return (
    <div className="flex min-h-full flex-col">
      <AnalyzerPageHeader title={PAGE_TITLE} />

      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-5 pb-6 sm:space-y-5 sm:px-6 sm:pt-7 sm:pb-8">
        <GeminiKeyNotice />

        {showInput ? (
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
            imageHint={UI.hints.dokaiImage}
            imageAlt={UI.hints.dokaiImageAlt}
            textTitle={UI.hints.dokaiTextTitle}
            textHint={UI.hints.dokaiTextHint}
            textPlaceholder={"本文をここに貼り付けてください。\n設問があれば続けて貼ってください。"}
            textareaId="dokai-text-input"
            onTextChange={(value) => {
              setTextInput(value);
              setPrepared(null);
              setError(null);
              clearResults();
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
        ) : null}

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
          <AnalysisSkeleton label={UI.hints.dokaiLoading} cards={3} />
        ) : null}

        {hasResults ? (
          <section className="space-y-4 sm:space-y-5">
            <div className="flex items-end justify-between gap-3 px-0.5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {UI.results.results}
                </p>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                  {questions.length > 0
                    ? `${questions.length} question${questions.length === 1 ? "" : "s"}`
                    : UI.results.readingOverview}
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
                onClick={startNewAnalysis}
              >
                <Plus className="size-3.5" aria-hidden />{UI.results.new}</Button>
            </div>

            {passageText ? (
              <article
                className={[
                  "relative overflow-hidden rounded-2xl",
                  "border border-border/55 bg-paper",
                  "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_06%,transparent),0_12px_28px_-18px_color-mix(in_oklab,var(--foreground)_18%,transparent)]",
                  "ring-1 ring-black/[0.02]",
                  "dark:border-white/[0.08] dark:bg-card dark:ring-white/[0.03]",
                  "dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_16px_36px_-20px_rgba(0,0,0,0.65)]",
                ].join(" ")}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--moss)_08%,transparent),transparent)] dark:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--moss)_14%,transparent),transparent)]"
                />
                <div className="relative border-l-[3px] border-l-moss/70 dark:border-l-moss/55">
                  <div className="px-5 pt-5 sm:px-7 sm:pt-6">
                    <div className="flex items-center gap-2.5">
                      <span className="size-1.5 rounded-full bg-moss/80 dark:bg-moss/70" aria-hidden />
                      <SectionLabel>{UI.results.passage}</SectionLabel>
                    </div>
                  </div>
                  <div className="relative px-5 pt-4 pb-6 sm:px-7 sm:pt-5 sm:pb-8">
                    <FuriganaHover
                      text={passageText}
                      readings={passageReadings}
                      meanings={passageMeanings}
                      lang="ja"
                      className={[
                        "block w-full font-serif whitespace-pre-wrap break-words",
                        "text-[1.08rem] leading-[2.1] tracking-[0.015em] text-foreground/95",
                        "sm:text-[1.16rem] sm:leading-[2.2]",
                        "dark:text-foreground/92",
                      ].join(" ")}
                    />
                  </div>
                </div>
              </article>
            ) : null}

            {summaryBurmese || intentBurmese ? (
              <article className="overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] dark:border-border/50 dark:ring-white/[0.03]">
                <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                  {summaryBurmese ? (
                    <div>
                      <SectionLabel>{UI.results.summary}</SectionLabel>
                      <p
                        lang="my"
                        className="mt-2 font-myanmar text-[14px] leading-7 break-words text-foreground/90"
                      >
                        {summaryBurmese}
                      </p>
                    </div>
                  ) : null}
                  {intentBurmese ? (
                    <div className={summaryBurmese ? "border-t border-border/40 pt-4 dark:border-white/[0.06]" : ""}>
                      <SectionLabel>{UI.results.intent}</SectionLabel>
                      <p
                        lang="my"
                        className="mt-2 font-myanmar text-[14px] leading-7 break-words text-muted-foreground"
                      >
                        {intentBurmese}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            ) : null}

            {questions.length > 0 ? (
              <div className="grid gap-3">
                {questions.map((question) => (
                  <DokaiQuestionCard
                    key={`${question.question_number}-${question.question_text}`}
                    question={question}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
