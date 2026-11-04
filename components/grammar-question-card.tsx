"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import { harvestMarkupReadings } from "@/lib/furigana";
import { splitGrammarQuestionText } from "@/lib/grammar-format";
import type { GrammarOptionRow, GrammarQuestion } from "@/src/constants/grammarPrompt";

function isCorrectOption(option: string, correct: string): boolean {
  return option.trim() !== "" && option.trim() === correct.trim();
}

function buildGrammarReadings(question: GrammarQuestion): Record<string, string> {
  const map: Record<string, string> = {};
  harvestMarkupReadings(question.questionText, map);
  harvestMarkupReadings(question.grammarPattern, map);
  harvestMarkupReadings(question.explanation_burmese, map);
  harvestMarkupReadings(question.related_grammar_burmese, map);

  for (const row of question.options_table) {
    const surface = row.japanese.trim();
    const reading = row.reading.trim();
    if (surface && reading) map[surface] = reading;
    harvestMarkupReadings(row.japanese, map);
    harvestMarkupReadings(row.meaning_burmese, map);
    harvestMarkupReadings(row.usage_burmese, map);
    harvestMarkupReadings(row.example_sentence, map);
    harvestMarkupReadings(row.example_burmese, map);
    harvestMarkupReadings(row.why_wrong_burmese, map);
  }

  return map;
}

/** Prefer structured options_table; fall back to parsing questionText choices. */
function resolveOptions(question: GrammarQuestion): GrammarOptionRow[] {
  if (question.options_table.length > 0) return question.options_table;

  const parts = splitGrammarQuestionText(question.questionText || "");
  return parts.options.map((opt) => ({
    option: opt.label,
    japanese: opt.text,
    reading: "",
    meaning_burmese: "",
    usage_burmese: "",
    example_sentence: "",
    example_burmese: "",
    why_wrong_burmese: "",
  }));
}

function CorrectBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 whitespace-nowrap dark:border-emerald-400/30 dark:bg-emerald-400/[0.10] dark:text-emerald-300">
      <Check className="size-2.5" aria-hidden />
      正解
    </span>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase dark:border-white/[0.06] dark:bg-white/[0.04]">
      {children}
    </span>
  );
}

function SectionLabel({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "sky" | "rose" | "amber";
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-700 dark:text-sky-300"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-300"
        : tone === "amber"
          ? "text-amber-800 dark:text-amber-300"
          : "text-muted-foreground";
  return (
    <h3 className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${toneClass}`}>{children}</h3>
  );
}

function ProseWithFurigana({
  text,
  readings,
  className,
  lang = "my",
}: {
  text: string;
  readings: Record<string, string>;
  className?: string;
  lang?: string;
}) {
  if (!text.trim()) {
    return (
      <span lang={lang} className={className}>
        —
      </span>
    );
  }

  return <FuriganaHover text={text} readings={readings} lang={lang} className={className} />;
}

/** Usage / detail sub-block with light contrast. */
function DetailSubBlock({
  label,
  text,
  readings,
}: {
  label: string;
  text: string;
  readings: Record<string, string>;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/25 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]">
      <MicroLabel>{label}</MicroLabel>
      <ProseWithFurigana
        text={text}
        readings={readings}
        className="mt-2 block font-myanmar text-sm leading-relaxed break-words text-muted-foreground"
      />
    </div>
  );
}

/** Quote-style Japanese + Burmese example. */
function ExampleQuote({
  sentence,
  burmese,
  readings,
  correct = false,
}: {
  sentence: string;
  burmese: string;
  readings: Record<string, string>;
  correct?: boolean;
}) {
  if (!sentence && !burmese) return null;

  const accent = correct
    ? "border-l-emerald-500/40 bg-emerald-500/[0.05] dark:bg-emerald-400/[0.06]"
    : "border-l-border/60 bg-muted/20 dark:border-l-white/15 dark:bg-white/[0.03]";

  return (
    <div className={`rounded-r-lg border-l-2 py-2.5 pr-3 pl-3 ${accent}`}>
      <MicroLabel>Example</MicroLabel>
      {sentence ? (
        <FuriganaHover
          text={sentence}
          readings={readings}
          className="mt-2 block font-serif text-sm leading-relaxed tracking-tight break-words text-foreground/90"
        />
      ) : null}
      {burmese ? (
        <ProseWithFurigana
          text={burmese}
          readings={readings}
          className="mt-1.5 block font-myanmar text-sm leading-relaxed break-words text-muted-foreground"
        />
      ) : null}
    </div>
  );
}

function OptionBreakdownCard({
  row,
  correct,
  readings,
}: {
  row: GrammarOptionRow;
  correct: boolean;
  readings: Record<string, string>;
}) {
  return (
    <section
      className={[
        "rounded-xl border px-4 py-3.5 transition-colors duration-200 sm:px-5 sm:py-4",
        correct
          ? "border-emerald-500/30 bg-emerald-500/[0.04] dark:border-emerald-400/25 dark:bg-emerald-400/[0.05]"
          : "border-border/55 bg-card/60 dark:border-white/[0.08] dark:bg-white/[0.02]",
      ].join(" ")}
    >
      {/* Inline flex header: No. + 正解 */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide tabular-nums",
            correct
              ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
              : "bg-muted/50 text-muted-foreground",
          ].join(" ")}
        >
          No. {row.option || "—"}
        </span>
        {correct ? <CorrectBadge /> : null}
      </div>

      {/* Pattern + short meaning */}
      <div className="mt-3 space-y-1.5">
        <p
          className={[
            "font-serif text-[1.05rem] leading-relaxed tracking-tight break-words",
            correct ? "font-semibold text-foreground" : "font-medium text-foreground",
          ].join(" ")}
        >
          <FuriganaHover text={row.japanese || "—"} reading={row.reading} readings={readings} />
        </p>
        {row.meaning_burmese ? (
          <ProseWithFurigana
            text={row.meaning_burmese}
            readings={readings}
            className={[
              "block font-myanmar text-sm leading-relaxed break-words",
              correct ? "text-emerald-800/75 dark:text-emerald-100/70" : "text-muted-foreground",
            ].join(" ")}
          />
        ) : null}
      </div>

      {row.usage_burmese ? (
        <div className="mt-3">
          <DetailSubBlock label="Usage & context" text={row.usage_burmese} readings={readings} />
        </div>
      ) : null}

      {/* Example quote */}
      {row.example_sentence || row.example_burmese ? (
        <div className="mt-3">
          <ExampleQuote
            sentence={row.example_sentence}
            burmese={row.example_burmese}
            readings={readings}
            correct={correct}
          />
        </div>
      ) : null}
    </section>
  );
}

function DistractorCard({
  row,
  readings,
}: {
  row: GrammarOptionRow;
  readings: Record<string, string>;
}) {
  return (
    <section className="rounded-xl border border-rose-500/15 bg-rose-500/[0.03] px-4 py-3.5 dark:border-rose-400/15 dark:bg-rose-400/[0.04]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/[0.08] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200">
          <X className="size-2.5" aria-hidden />
          誤答 {row.option || "—"}
        </span>
        <span className="font-serif text-[15px] font-medium leading-relaxed tracking-tight text-foreground">
          <FuriganaHover text={row.japanese || "—"} reading={row.reading} readings={readings} />
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {row.meaning_burmese ? (
          <div>
            <MicroLabel>Meaning</MicroLabel>
            <ProseWithFurigana
              text={row.meaning_burmese}
              readings={readings}
              className="mt-2 block font-myanmar text-sm leading-relaxed break-words text-muted-foreground"
            />
          </div>
        ) : null}

        {row.usage_burmese ? (
          <DetailSubBlock label="Usage & context" text={row.usage_burmese} readings={readings} />
        ) : null}

        {row.example_sentence || row.example_burmese ? (
          <ExampleQuote
            sentence={row.example_sentence}
            burmese={row.example_burmese}
            readings={readings}
          />
        ) : null}

        {row.why_wrong_burmese ? (
          <div className="rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2.5 dark:border-rose-400/15">
            <MicroLabel>Why it doesn&apos;t fit</MicroLabel>
            <ProseWithFurigana
              text={row.why_wrong_burmese}
              readings={readings}
              className="mt-2 block font-myanmar text-sm leading-relaxed break-words text-muted-foreground"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function GrammarQuestionCard({ question }: { question: GrammarQuestion }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const readings = useMemo(() => buildGrammarReadings(question), [question]);
  const options = useMemo(() => resolveOptions(question), [question]);
  const stem = useMemo(() => {
    const parts = splitGrammarQuestionText(question.questionText || "");
    return parts.stem || question.questionText || "—";
  }, [question.questionText]);
  const distractors = options.filter((row) => !isCorrectOption(row.option, question.correctAnswer));
  const hasDistractorDetail = distractors.some(
    (row) =>
      row.meaning_burmese ||
      row.usage_burmese ||
      row.example_sentence ||
      row.example_burmese ||
      row.why_wrong_burmese,
  );
  const hasDetails = Boolean(
    question.explanation_burmese || question.related_grammar_burmese || hasDistractorDetail,
  );

  return (
    <article className="w-full overflow-hidden rounded-xl border border-border/55 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/45 dark:ring-white/[0.03]">
      {/* Header: badges + stem only — no pattern / meaning duplication */}
      <div className="border-b border-border/45 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide">
            文法
          </Badge>
          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
            Q{question.questionNumber || "—"}
          </Badge>
          {question.correctAnswer ? (
            <Badge
              variant="outline"
              className="ml-auto rounded-full border-emerald-500/30 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/[0.08] dark:border-emerald-400/30 dark:bg-emerald-400/[0.10] dark:text-emerald-300 dark:hover:bg-emerald-400/[0.10]"
            >
              <Check className="size-3" aria-hidden />
              正解 {question.correctAnswer}
            </Badge>
          ) : null}
        </div>

        <FuriganaHover
          text={stem}
          readings={readings}
          className="mt-3.5 block font-serif text-[1.05rem] leading-relaxed tracking-tight break-words whitespace-pre-wrap text-foreground sm:text-lg sm:leading-relaxed"
        />
      </div>

      <div className="space-y-3 p-3.5 sm:p-4">
        {/* Unified option breakdown cards */}
        {options.length > 0 ? (
          <div className="space-y-3">
            {options.map((row) => {
              const correct = isCorrectOption(row.option, question.correctAnswer);
              return (
                <OptionBreakdownCard
                  key={`${row.option}-${row.japanese}`}
                  row={row}
                  correct={correct}
                  readings={readings}
                />
              );
            })}
          </div>
        ) : null}

        {hasDetails ? (
          <div
            className={[
              "overflow-hidden rounded-xl border border-dashed transition-colors duration-200",
              detailsOpen
                ? "border-sky-500/25 bg-sky-500/[0.04] dark:border-sky-400/20 dark:bg-sky-400/[0.05]"
                : "border-border/50 bg-muted/20 dark:border-white/10 dark:bg-white/[0.02]",
            ].join(" ")}
          >
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-black/[0.015] active:bg-black/[0.025] dark:hover:bg-white/[0.025] sm:min-h-0"
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-foreground">
                  Explanation & Distractors
                </span>
                <span lang="my" className="mt-0.5 block font-myanmar text-xs leading-relaxed text-muted-foreground">
                  အသေးစိတ် ရှင်းလင်းချက် နှင့် မှားသော ရွေးချယ်မှုများ
                </span>
              </span>
              <span
                className={[
                  "grid size-8 shrink-0 place-items-center rounded-lg border border-border/55 bg-background/80 text-muted-foreground transition-all duration-200 dark:border-white/10",
                  detailsOpen
                    ? "rotate-180 border-sky-500/30 text-sky-700 dark:border-sky-400/30 dark:text-sky-300"
                    : "",
                ].join(" ")}
              >
                <ChevronDown className="size-4" aria-hidden />
              </span>
            </button>

            <div
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 border-t border-border/40 px-4 pt-3.5 pb-4 dark:border-white/8">
                  {question.explanation_burmese ? (
                    <section className="rounded-xl border border-border/50 bg-background/70 px-4 py-3.5 dark:border-white/8 dark:bg-black/15">
                      <SectionLabel tone="sky">Answer justification</SectionLabel>
                      <ProseWithFurigana
                        text={question.explanation_burmese}
                        readings={readings}
                        className="mt-2.5 block font-myanmar text-sm leading-relaxed break-words text-muted-foreground"
                      />
                    </section>
                  ) : null}

                  {question.related_grammar_burmese ? (
                    <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3.5 dark:border-amber-500/20 dark:bg-amber-950/20">
                      <SectionLabel tone="amber">Related / confusing grammar</SectionLabel>
                      <ProseWithFurigana
                        text={question.related_grammar_burmese}
                        readings={readings}
                        className="mt-2.5 block font-myanmar text-sm leading-relaxed break-words text-amber-950/80 dark:text-amber-50/85"
                      />
                    </section>
                  ) : null}

                  {hasDistractorDetail ? (
                    <section className="space-y-3">
                      <SectionLabel tone="rose">Wrong options</SectionLabel>
                      <div className="grid gap-3">
                        {distractors.map((row) => (
                          <DistractorCard
                            key={`d-${row.option}-${row.japanese}`}
                            row={row}
                            readings={readings}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
