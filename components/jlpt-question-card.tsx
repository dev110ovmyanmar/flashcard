"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";
import { FuriganaSentence, FuriganaText } from "@/components/furigana-text";
import { Badge } from "@/components/ui/badge";
import type { JlptOptionRow, JlptQuestion } from "@/src/constants/jlptPrompt";

function isCorrectOption(option: string, correct: string): boolean {
  return option.trim() !== "" && option.trim() === correct.trim();
}

function optionRowClass(correct: boolean, zebra: boolean): string {
  if (correct) {
    return [
      "border-l-[3px] border-l-emerald-500 bg-emerald-50/90 text-foreground",
      "shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]",
      "dark:border-l-emerald-400 dark:bg-emerald-500/[0.12]",
      "dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22),0_0_24px_-8px_rgba(16,185,129,0.35)]",
    ].join(" ");
  }
  return zebra ? "bg-muted/25" : "bg-card";
}

function CorrectBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-100/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 whitespace-nowrap dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-200 dark:shadow-[0_0_12px_-4px_rgba(52,211,153,0.55)]">
      <Check className="size-2.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
      正解
    </span>
  );
}

function MobileOptionCard({
  row,
  correct,
  zebra,
}: {
  row: JlptOptionRow;
  correct: boolean;
  zebra: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border px-3.5 py-3.5 transition-colors",
        correct
          ? "border-emerald-300/70 dark:border-emerald-400/30"
          : "border-border/50",
        optionRowClass(correct, zebra),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            "tabular-nums text-sm",
            correct ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
          ].join(" ")}
        >
          No. {row.option || "—"}
        </span>
        {correct ? <CorrectBadge /> : null}
      </div>
      <p
        className={[
          "mt-2.5 font-serif text-lg leading-8 tracking-tight break-words sm:text-[1.2rem]",
          correct ? "font-semibold text-emerald-950 dark:text-emerald-50" : "font-medium text-foreground",
        ].join(" ")}
      >
        <FuriganaText text={row.japanese || "—"} reading={row.reading} />
      </p>
      <p
        lang="my"
        className={[
          "mt-1.5 font-myanmar text-[14px] leading-7 break-words",
          correct
            ? "text-emerald-800/80 dark:text-emerald-100/75"
            : "text-muted-foreground",
        ].join(" ")}
      >
        {row.meaning_burmese || "—"}
      </p>
      {row.usage_burmese ? (
        <p lang="my" className="mt-1.5 font-myanmar text-[13px] leading-6 break-words text-muted-foreground/90">
          {row.usage_burmese}
        </p>
      ) : null}
    </div>
  );
}

function DistractorCard({ row }: { row: JlptOptionRow }) {
  return (
    <section className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3 py-3 dark:border-rose-400/15 dark:bg-rose-400/[0.06] sm:px-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/70 bg-rose-100/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200">
          <X className="size-2.5" aria-hidden />
          誤答 {row.option || "—"}
        </span>
        <span className="font-serif text-base font-medium tracking-tight text-foreground">
          <FuriganaText text={row.japanese || "—"} reading={row.reading} />
        </span>
      </div>
      <dl className="mt-2.5 space-y-2">
        <div>
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Meaning
          </dt>
          <dd lang="my" className="mt-0.5 font-myanmar text-[14px] leading-6 break-words text-muted-foreground">
            {row.meaning_burmese || "—"}
          </dd>
        </div>
        {row.usage_burmese ? (
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Usage & context
            </dt>
            <dd lang="my" className="mt-0.5 font-myanmar text-[14px] leading-6 break-words text-muted-foreground">
              {row.usage_burmese}
            </dd>
          </div>
        ) : null}
        {row.why_wrong_burmese ? (
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-rose-700 uppercase dark:text-rose-300">
              Why it doesn&apos;t fit
            </dt>
            <dd lang="my" className="mt-0.5 font-myanmar text-[14px] leading-6 break-words text-muted-foreground">
              {row.why_wrong_burmese}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function JlptQuestionCard({ question }: { question: JlptQuestion }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const distractors = question.options_table.filter(
    (row) => !isCorrectOption(row.option, question.correct_option),
  );
  const hasDistractorDetail = distractors.some(
    (row) => row.usage_burmese || row.why_wrong_burmese || row.meaning_burmese,
  );
  const hasDetails = Boolean(
    question.explanation_burmese || question.nuance_note || hasDistractorDetail,
  );

  return (
    <article className="w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs ring-1 ring-black/[0.03] dark:border-border/50 dark:ring-white/[0.04]">
      <div className="border-b border-border/50 bg-muted/20 p-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
            問題{question.mondai_type}
          </Badge>
          <Badge variant="secondary" className="rounded-md px-2.5 py-0.5 text-[11px] font-medium">
            Q{question.question_number}
          </Badge>
          {question.correct_option ? (
            <Badge
              variant="outline"
              className="ml-auto rounded-md border-emerald-300/80 bg-emerald-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/90 dark:border-emerald-400/35 dark:bg-emerald-500/20 dark:text-emerald-200 dark:shadow-[0_0_12px_-4px_rgba(52,211,153,0.45)] dark:hover:bg-emerald-500/20"
            >
              <Check className="size-3 text-emerald-600 dark:text-emerald-300" aria-hidden />
              正解 {question.correct_option}
            </Badge>
          ) : null}
        </div>

        <FuriganaSentence
          text={question.japanese_sentence || "—"}
          tokens={question.furigana_tokens}
          targetWord={question.target_word}
          targetReading={question.reading}
          className="mt-3 block font-serif text-[1.05rem] leading-[1.7] tracking-tight break-words text-foreground sm:mt-3.5 sm:text-xl sm:leading-[1.65]"
        />

        {(question.target_word || question.reading) && (
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {question.target_word ? (
              <span className="font-medium break-words text-foreground/85">
                <FuriganaText text={question.target_word} reading={question.reading} />
              </span>
            ) : null}
            {question.reading && !question.target_word ? (
              <span className="tracking-[0.06em] break-words text-muted-foreground">{question.reading}</span>
            ) : null}
          </p>
        )}
      </div>

      <div className="p-3 sm:p-5">
        {question.options_table.length > 0 ? (
          <>
            {/* Mobile: stacked option cards — no horizontal scroll */}
            <div className="grid gap-2.5 sm:hidden">
              {question.options_table.map((row, index) => {
                const correct = isCorrectOption(row.option, question.correct_option);
                return (
                  <MobileOptionCard
                    key={`${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}-m`}
                    row={row}
                    correct={correct}
                    zebra={index % 2 === 1}
                  />
                );
              })}
            </div>

            {/* Desktop / tablet: compact table */}
            <div className="hidden overflow-hidden rounded-xl border border-border/60 dark:border-white/10 sm:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[36%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="bg-muted/45 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    <th className="px-3.5 py-2.5 font-medium">No.</th>
                    <th className="px-3.5 py-2.5 font-medium">漢字</th>
                    <th className="px-3.5 py-2.5 font-medium">意味</th>
                  </tr>
                </thead>
                <tbody>
                  {question.options_table.map((row, index) => {
                    const correct = isCorrectOption(row.option, question.correct_option);
                    const zebra = index % 2 === 1;
                    return (
                      <tr
                        key={`${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}`}
                        className={[
                          "border-t border-border/45 transition-colors",
                          optionRowClass(correct, zebra),
                        ].join(" ")}
                      >
                        <td
                          className={[
                            "px-3.5 py-3.5 align-middle tabular-nums",
                            correct
                              ? "font-semibold text-emerald-700 dark:text-emerald-300"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {row.option || "—"}
                        </td>
                        <td className="px-3.5 py-3.5 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "font-serif text-lg leading-8 tracking-tight break-words",
                                correct
                                  ? "font-semibold text-emerald-950 dark:text-emerald-50"
                                  : "font-medium text-foreground",
                              ].join(" ")}
                            >
                              <FuriganaText text={row.japanese || "—"} reading={row.reading} />
                            </span>
                            {correct ? <CorrectBadge /> : null}
                          </div>
                        </td>
                        <td
                          lang="my"
                          className={[
                            "px-3.5 py-3.5 align-middle font-myanmar text-[14px] leading-7 break-words",
                            correct
                              ? "text-emerald-800/80 dark:text-emerald-100/75"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          <span className="block">{row.meaning_burmese || "—"}</span>
                          {row.usage_burmese ? (
                            <span className="mt-1 block text-[13px] leading-6 opacity-85">{row.usage_burmese}</span>
                          ) : null}
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
              "mt-4 overflow-hidden rounded-xl border border-dashed transition-colors duration-300 sm:mt-5",
              detailsOpen
                ? "border-sky-500/25 bg-sky-500/[0.07] dark:border-sky-400/20 dark:bg-sky-400/[0.08]"
                : "border-border/70 bg-muted/40 dark:border-white/12 dark:bg-white/[0.035]",
            ].join(" ")}
          >
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] sm:min-h-0 sm:px-4 sm:py-3"
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-foreground">
                  Explanation & Distractors
                </span>
                <span lang="my" className="mt-0.5 block font-myanmar text-xs leading-5 text-muted-foreground">
                  အသေးစိတ် ရှင်းလင်းချက် နှင့် မှားသော ရွေးချယ်မှုများ
                </span>
              </span>
              <span
                className={[
                  "grid size-10 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition-all duration-300 ease-out dark:border-white/10 dark:bg-white/[0.04] sm:size-8",
                  detailsOpen ? "rotate-180 border-sky-500/30 text-sky-700 dark:border-sky-400/30 dark:text-sky-300" : "",
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
                <div className="space-y-3 border-t border-border/40 px-3 pt-3 pb-3.5 dark:border-white/8 sm:px-4 sm:pb-4">
                  {question.explanation_burmese ? (
                    <section className="rounded-lg border border-border/50 bg-background/70 px-3 py-3 dark:border-white/8 dark:bg-black/20 sm:px-3.5">
                      <h3 className="text-[10px] font-semibold tracking-[0.16em] text-sky-700 uppercase dark:text-sky-300">
                        Explanation
                      </h3>
                      <p lang="my" className="mt-2 font-myanmar text-[15px] leading-7 break-words text-muted-foreground">
                        {question.explanation_burmese}
                      </p>
                    </section>
                  ) : null}
                  {question.nuance_note ? (
                    <section className="rounded-lg border border-border/40 bg-muted/40 px-3 py-3 dark:border-white/6 dark:bg-white/[0.03] sm:px-3.5">
                      <h3 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        Nuance & Context
                      </h3>
                      <p lang="my" className="mt-2 font-myanmar text-[15px] leading-7 break-words text-muted-foreground">
                        {question.nuance_note}
                      </p>
                    </section>
                  ) : null}
                  {hasDistractorDetail ? (
                    <section className="space-y-2.5">
                      <h3 className="text-[10px] font-semibold tracking-[0.16em] text-rose-700 uppercase dark:text-rose-300">
                        Wrong options
                      </h3>
                      <div className="grid gap-2.5">
                        {distractors.map((row) => (
                          <DistractorCard
                            key={`d-${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}`}
                            row={row}
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
