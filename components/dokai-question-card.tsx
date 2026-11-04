"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import { harvestMarkupReadings } from "@/lib/furigana";
import type { DokaiOptionRow, DokaiQuestion } from "@/src/constants/dokaiPrompt";
import { UI } from "@/src/constants/uiCopy";

function isCorrectOption(option: string, correct: string): boolean {
  return option.trim() !== "" && option.trim() === correct.trim();
}

function buildDokaiReadings(question: DokaiQuestion): Record<string, string> {
  const map: Record<string, string> = {};
  harvestMarkupReadings(question.question_text, map);
  harvestMarkupReadings(question.explanation_burmese, map);
  for (const row of question.options_table) {
    harvestMarkupReadings(row.japanese, map);
    harvestMarkupReadings(row.meaning_burmese, map);
    harvestMarkupReadings(row.why_wrong_burmese, map);
  }
  return map;
}

function optionRowClass(correct: boolean, zebra: boolean): string {
  if (correct) {
    return [
      "border-l-[3px] border-l-emerald-500/90 bg-emerald-50/80",
      "dark:border-l-emerald-400 dark:bg-emerald-500/[0.10]",
    ].join(" ");
  }
  return zebra ? "bg-muted/20" : "bg-transparent";
}

function CorrectBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/70 bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 whitespace-nowrap dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
      <Check className="size-2.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
      {UI.card.correct}
    </span>
  );
}

function SectionLabel({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "sky" | "rose";
}) {
  const toneClass =
    tone === "sky"
      ? "text-sky-700 dark:text-sky-300"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-300"
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

function MobileOptionCard({
  row,
  correct,
  zebra,
  readings,
}: {
  row: DokaiOptionRow;
  correct: boolean;
  zebra: boolean;
  readings: Record<string, string>;
}) {
  return (
    <div
      className={[
        "rounded-lg border px-3.5 py-3 transition-colors duration-200",
        correct ? "border-emerald-300/60 dark:border-emerald-400/25" : "border-border/50",
        optionRowClass(correct, zebra),
      ].join(" ")}
    >
      {correct ? (
        <div className="mb-2">
          <CorrectBadge />
        </div>
      ) : null}
      <p
        className={[
          "font-serif text-[1.05rem] leading-7 tracking-tight break-words [overflow-wrap:anywhere]",
          correct
            ? "font-semibold text-emerald-950 dark:text-emerald-50"
            : "font-medium text-foreground",
        ].join(" ")}
      >
        <FuriganaHover text={row.japanese || "—"} readings={readings} />
      </p>
      <ProseWithFurigana
        text={row.meaning_burmese || "—"}
        readings={readings}
        className={[
          "mt-1.5 block font-myanmar text-[13px] leading-6 break-words",
          correct ? "text-emerald-800/80 dark:text-emerald-100/75" : "text-muted-foreground",
        ].join(" ")}
      />
    </div>
  );
}

function DistractorCard({
  row,
  readings,
}: {
  row: DokaiOptionRow;
  readings: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-3.5 py-3 dark:border-rose-400/15 dark:bg-rose-400/[0.05]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/60 bg-rose-100/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/12 dark:text-rose-200">
          <X className="size-2.5" aria-hidden />
          {UI.card.wrong}
        </span>
        <span className="font-serif text-[15px] font-medium tracking-tight text-foreground">
          <FuriganaHover text={row.japanese || "—"} readings={readings} />
        </span>
      </div>
      <dl className="mt-2.5 space-y-2">
        <div>
          <SectionLabel>{UI.card.meaning}</SectionLabel>
          <dd className="mt-1">
            <ProseWithFurigana
              text={row.meaning_burmese || "—"}
              readings={readings}
              className="font-myanmar text-[13px] leading-6 break-words text-muted-foreground"
            />
          </dd>
        </div>
        {row.why_wrong_burmese ? (
          <div>
            <SectionLabel tone="rose">{UI.card.whyWrong}</SectionLabel>
            <dd className="mt-1">
              <ProseWithFurigana
                text={row.why_wrong_burmese}
                readings={readings}
                className="font-myanmar text-[13px] leading-6 break-words text-muted-foreground"
              />
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function DokaiQuestionCard({ question }: { question: DokaiQuestion }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const readings = useMemo(() => buildDokaiReadings(question), [question]);
  const distractors = question.options_table.filter(
    (row) => !isCorrectOption(row.option, question.correct_option),
  );
  const hasDistractorDetail = distractors.some(
    (row) => row.why_wrong_burmese || row.meaning_burmese,
  );
  const hasDetails = Boolean(question.explanation_burmese || hasDistractorDetail);

  return (
    <article className="w-full overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/50 dark:ring-white/[0.03]">
      <div className="border-b border-border/50 bg-muted/15 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
            Q{question.question_number || "—"}
          </Badge>
          {question.correct_option ? (
            <Badge
              variant="outline"
              className="ml-auto rounded-md border-emerald-300/70 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
            >
              <Check className="size-3 text-emerald-600 dark:text-emerald-300" aria-hidden />
              {UI.card.correct} {question.correct_option}
            </Badge>
          ) : null}
        </div>

        <FuriganaHover
          text={question.question_text || "—"}
          readings={readings}
          className="mt-3 block font-serif text-[1.05rem] leading-[1.65] tracking-tight break-words text-foreground sm:text-lg sm:leading-[1.6]"
        />
      </div>

      <div className="p-3.5 sm:p-4">
        {question.options_table.length > 0 ? (
          <>
            <div className="grid gap-2 sm:hidden">
              {question.options_table.map((row, index) => {
                const correct = isCorrectOption(row.option, question.correct_option);
                return (
                  <MobileOptionCard
                    key={`${question.question_number}-${row.option}-${row.japanese}-m`}
                    row={row}
                    correct={correct}
                    zebra={index % 2 === 1}
                    readings={readings}
                  />
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-border/55 dark:border-white/8 sm:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[48%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/50 bg-muted/35">
                    <th className="px-3.5 py-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {UI.card.choice}
                    </th>
                    <th className="px-3.5 py-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {UI.card.meaning}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {question.options_table.map((row, index) => {
                    const correct = isCorrectOption(row.option, question.correct_option);
                    const zebra = index % 2 === 1;
                    return (
                      <tr
                        key={`${question.question_number}-${row.option}-${row.japanese}`}
                        className={[
                          "border-t border-border/40 transition-colors duration-150",
                          optionRowClass(correct, zebra),
                        ].join(" ")}
                      >
                        <td className="min-w-0 px-3.5 py-3 align-middle">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className={[
                                "min-w-0 font-serif text-[15px] leading-7 tracking-tight break-words [overflow-wrap:anywhere]",
                                correct
                                  ? "font-semibold text-emerald-950 dark:text-emerald-50"
                                  : "font-medium text-foreground",
                              ].join(" ")}
                            >
                              <FuriganaHover text={row.japanese || "—"} readings={readings} />
                            </span>
                            {correct ? <CorrectBadge /> : null}
                          </div>
                        </td>
                        <td
                          className={[
                            "min-w-0 px-3.5 py-3 align-middle font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere]",
                            correct
                              ? "text-emerald-800/80 dark:text-emerald-100/75"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          <ProseWithFurigana
                            text={row.meaning_burmese || "—"}
                            readings={readings}
                            className="block"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {hasDetails ? (
          <div
            className={[
              "mt-3 overflow-hidden rounded-lg border border-dashed transition-colors duration-200",
              detailsOpen
                ? "border-sky-500/25 bg-sky-500/[0.05] dark:border-sky-400/20 dark:bg-sky-400/[0.06]"
                : "border-border/55 bg-muted/25 dark:border-white/10 dark:bg-white/[0.025]",
            ].join(" ")}
          >
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-all duration-200 hover:bg-black/[0.02] active:bg-black/[0.03] dark:hover:bg-white/[0.03] sm:min-h-0"
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-foreground">
                  {UI.card.explanationDetails}
                </span>
                <span lang="my" className="mt-0.5 block font-myanmar text-xs leading-5 text-muted-foreground">
                  {UI.card.explanationMy}
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
                <div className="space-y-2.5 border-t border-border/40 px-3.5 pt-3 pb-3.5 dark:border-white/8">
                  {question.explanation_burmese ? (
                    <section className="rounded-lg border border-border/50 bg-background/70 px-3.5 py-3 dark:border-white/8 dark:bg-black/15">
                      <SectionLabel tone="sky">{UI.card.explanation}</SectionLabel>
                      <ProseWithFurigana
                        text={question.explanation_burmese}
                        readings={readings}
                        className="mt-2 block font-myanmar text-[14px] leading-7 break-words text-muted-foreground"
                      />
                    </section>
                  ) : null}
                  {hasDistractorDetail ? (
                    <section className="space-y-2">
                      <SectionLabel tone="rose">{UI.card.wrongOptions}</SectionLabel>
                      <div className="grid gap-2">
                        {distractors.map((row) => (
                          <DistractorCard
                            key={`d-${question.question_number}-${row.option}-${row.japanese}`}
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
