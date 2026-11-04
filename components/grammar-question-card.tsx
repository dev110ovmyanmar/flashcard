"use client";

import { Check, ChevronDown } from "lucide-react";
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
  }));
}

function CorrectBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/70 bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 whitespace-nowrap dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
      <Check className="size-2.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
      正解
    </span>
  );
}

function SectionLabel({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "sky" | "amber";
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-700 dark:text-sky-300"
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

function OptionCard({
  row,
  correct,
  readings,
}: {
  row: GrammarOptionRow;
  correct: boolean;
  readings: Record<string, string>;
}) {
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3.5 transition-colors duration-200 sm:px-4 sm:py-4",
        correct
          ? [
              "border-emerald-300/70 border-l-[3px] border-l-emerald-500 bg-emerald-50/80",
              "dark:border-emerald-400/25 dark:border-l-emerald-400 dark:bg-emerald-500/[0.10]",
            ].join(" ")
          : "border-border/55 bg-card/50 dark:border-white/[0.07] dark:bg-white/[0.015]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={[
            "text-[11px] font-medium tabular-nums tracking-wide",
            correct ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
          ].join(" ")}
        >
          No. {row.option || "—"}
        </span>
        {correct ? <CorrectBadge /> : null}
      </div>

      <p
        className={[
          "mt-2.5 font-serif text-[1.05rem] leading-7 tracking-tight break-words sm:text-[1.1rem]",
          correct
            ? "font-semibold text-emerald-950 dark:text-emerald-50"
            : "font-semibold text-foreground",
        ].join(" ")}
      >
        <FuriganaHover text={row.japanese || "—"} reading={row.reading} readings={readings} />
      </p>

      {row.meaning_burmese ? (
        <ProseWithFurigana
          text={row.meaning_burmese}
          readings={readings}
          className={[
            "mt-1.5 block font-myanmar text-[13px] leading-6 break-words",
            correct ? "text-emerald-800/80 dark:text-emerald-100/75" : "text-muted-foreground",
          ].join(" ")}
        />
      ) : null}

      {row.usage_burmese ? (
        <div className="mt-3">
          <SectionLabel>Usage</SectionLabel>
          <ProseWithFurigana
            text={row.usage_burmese}
            readings={readings}
            className="mt-1.5 block font-myanmar text-[13px] leading-6 break-words text-muted-foreground"
          />
        </div>
      ) : null}

      {row.example_sentence || row.example_burmese ? (
        <div
          className={[
            "mt-3 border-l-2 pl-3",
            correct ? "border-emerald-500/45" : "border-border/70 dark:border-white/15",
          ].join(" ")}
        >
          <SectionLabel>Example</SectionLabel>
          {row.example_sentence ? (
            <FuriganaHover
              text={row.example_sentence}
              readings={readings}
              className="mt-1.5 block font-serif text-[14px] leading-6 tracking-tight break-words text-foreground/90"
            />
          ) : null}
          {row.example_burmese ? (
            <ProseWithFurigana
              text={row.example_burmese}
              readings={readings}
              className="mt-1 block font-myanmar text-[12px] leading-5 break-words text-muted-foreground"
            />
          ) : null}
        </div>
      ) : null}
    </div>
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

  const orderedOptions = useMemo(() => {
    const correct = options.filter((row) => isCorrectOption(row.option, question.correctAnswer));
    const rest = options.filter((row) => !isCorrectOption(row.option, question.correctAnswer));
    return [...correct, ...rest];
  }, [options, question.correctAnswer]);

  const hasDetails = Boolean(question.explanation_burmese || question.related_grammar_burmese);

  return (
    <article className="w-full overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/50 dark:ring-white/[0.03]">
      {/* Header */}
      <div className="border-b border-border/50 bg-muted/15 px-4 py-4 sm:px-5 sm:py-5">
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
              className="ml-auto rounded-md border-emerald-300/70 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
            >
              <Check className="size-3 text-emerald-600 dark:text-emerald-300" aria-hidden />
              正解 {question.correctAnswer}
            </Badge>
          ) : null}
        </div>

        {question.grammarPattern ? (
          <div className="mt-4">
            <SectionLabel>Pattern</SectionLabel>
            <FuriganaHover
              text={question.grammarPattern}
              readings={readings}
              className="mt-1.5 block font-serif text-[1.2rem] leading-[1.6] font-semibold tracking-tight break-words text-foreground sm:text-[1.35rem] sm:leading-[1.55]"
            />
            {question.grammar_meaning_burmese ? (
              <p
                lang="my"
                className="mt-1.5 font-myanmar text-[13px] leading-6 break-words text-muted-foreground"
              >
                {question.grammar_meaning_burmese}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={question.grammarPattern ? "mt-4" : "mt-4"}>
          <SectionLabel>Question</SectionLabel>
          <FuriganaHover
            text={stem}
            readings={readings}
            className="mt-1.5 block font-serif text-[1.02rem] leading-[1.7] tracking-tight break-words whitespace-pre-wrap text-foreground/95 sm:text-[1.08rem] sm:leading-[1.65]"
          />
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3 p-3.5 sm:p-4">
        {orderedOptions.length > 0 ? (
          <div className="grid gap-2.5">
            {orderedOptions.map((row) => {
              const correct = isCorrectOption(row.option, question.correctAnswer);
              return (
                <OptionCard
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
              "overflow-hidden rounded-xl border transition-colors duration-200",
              detailsOpen
                ? "border-sky-500/25 bg-sky-500/[0.04] dark:border-sky-400/20 dark:bg-sky-400/[0.05]"
                : "border-border/55 bg-muted/20 dark:border-white/10 dark:bg-white/[0.02]",
            ].join(" ")}
          >
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-black/[0.015] active:bg-black/[0.025] dark:hover:bg-white/[0.03] sm:min-h-0"
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-foreground">
                  Explanation
                </span>
                <span lang="my" className="mt-0.5 block font-myanmar text-xs leading-5 text-muted-foreground">
                  အသေးစိတ် ရှင်းလင်းချက်
                </span>
              </span>
              <span
                className={[
                  "grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground transition-all duration-200 dark:border-white/10",
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
                <div className="space-y-4 border-t border-border/40 px-4 pt-3.5 pb-4 dark:border-white/8">
                  {question.explanation_burmese ? (
                    <div>
                      <SectionLabel tone="sky">Why this is correct</SectionLabel>
                      <ProseWithFurigana
                        text={question.explanation_burmese}
                        readings={readings}
                        className="mt-2 block font-myanmar text-[14px] leading-7 break-words text-muted-foreground"
                      />
                    </div>
                  ) : null}

                  {question.related_grammar_burmese ? (
                    <div className="border-t border-border/40 pt-3.5 dark:border-white/8">
                      <SectionLabel tone="amber">Related grammar</SectionLabel>
                      <ProseWithFurigana
                        text={question.related_grammar_burmese}
                        readings={readings}
                        className="mt-2 block font-myanmar text-[14px] leading-7 break-words text-amber-950/85 dark:text-amber-50/90"
                      />
                    </div>
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
