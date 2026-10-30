"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { parseIncorrectReasonItems } from "@/lib/grammar-format";
import type { GrammarQuestion } from "@/src/constants/grammarPrompt";

function SectionHeader({
  title,
  burmeseLabel,
  titleClass,
  labelClass,
}: {
  title: string;
  burmeseLabel: string;
  titleClass: string;
  labelClass: string;
}) {
  return (
    <header className="mb-3.5">
      <h3 className={`text-xs font-bold tracking-wider uppercase ${titleClass}`}>{title}</h3>
      <p lang="my" className={`mt-1 font-myanmar text-[11px] leading-5 ${labelClass}`}>
        {burmeseLabel}
      </p>
    </header>
  );
}

function IncorrectOptionsBlock({ text }: { text: string }) {
  const items = parseIncorrectReasonItems(text);

  if (items.length >= 2) {
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.option}-${item.pattern}-${item.body.slice(0, 24)}`}
            className={[
              "rounded-lg border p-3 text-sm",
              "border-stone-200 bg-white text-stone-800",
              "dark:border-neutral-800/80 dark:bg-[#0d1117]/80 dark:text-neutral-200",
            ].join(" ")}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-block rounded px-2 py-0.5 text-xs font-semibold",
                  "bg-amber-100 text-amber-900",
                  "dark:bg-neutral-800 dark:text-amber-300",
                ].join(" ")}
              >
                {item.option || "—"}
                {item.pattern ? ` ${item.pattern}` : ""}
              </span>
            </div>
            <p lang="my" className="font-myanmar text-sm leading-relaxed break-words text-stone-800 dark:text-neutral-200">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p
      lang="my"
      className="font-myanmar text-sm leading-relaxed break-words whitespace-pre-wrap text-stone-800 dark:text-neutral-200"
    >
      {text}
    </p>
  );
}

function SyntaxBlock({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <div className="space-y-2.5 font-mono text-sm leading-relaxed text-indigo-950 dark:text-indigo-100/90">
      {lines.map((line, index) => (
        <p
          key={`${index}-${line.slice(0, 32)}`}
          className={[
            "break-words whitespace-pre-wrap",
            index === 0 ? "font-semibold tracking-tight" : "opacity-95",
          ].join(" ")}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function GrammarQuestionCard({ question }: { question: GrammarQuestion }) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const panelId = useId();
  const hasDetails = Boolean(
    question.correctReasonBurmese || question.incorrectReasonsBurmese || question.syntaxBreakdown,
  );

  return (
    <article
      className={[
        "w-full overflow-hidden rounded-2xl border shadow-sm",
        "border-stone-200 bg-white",
        "dark:border-neutral-800/80 dark:bg-[#0d1117] dark:shadow-xl",
      ].join(" ")}
    >
      <div
        className={[
          "border-b p-4 sm:p-5",
          "border-stone-200 bg-stone-50/80",
          "dark:border-neutral-800 dark:bg-[#161b22]",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
              "bg-stone-900 text-white",
              "dark:bg-neutral-800 dark:text-neutral-100",
            ].join(" ")}
          >
            Q{question.questionNumber || "—"}
          </span>
          {question.grammarPattern ? (
            <span
              className={[
                "max-w-full rounded-md px-2.5 py-0.5 text-[11px] font-medium break-words whitespace-normal",
                "bg-stone-100 text-stone-700",
                "dark:bg-neutral-800/90 dark:text-neutral-300",
              ].join(" ")}
            >
              {question.grammarPattern}
            </span>
          ) : null}
          {question.correctAnswer ? (
            <span
              className={[
                "ml-auto inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
                "border-emerald-200 bg-emerald-50 text-emerald-800",
                "dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300",
              ].join(" ")}
            >
              <Check className="size-3" aria-hidden />
              正解 {question.correctAnswer}
            </span>
          ) : null}
        </div>

        <p
          className={[
            "mt-4 font-serif text-[1.05rem] leading-[1.55] tracking-tight whitespace-pre-wrap break-words sm:text-xl sm:leading-[1.5]",
            "text-stone-900",
            "dark:text-neutral-100",
          ].join(" ")}
        >
          {question.questionText || "—"}
        </p>
      </div>

      {hasDetails ? (
        <div className="p-4 sm:p-5">
          <div
            className={[
              "overflow-hidden rounded-xl border transition-colors duration-300",
              "border-stone-200 bg-stone-50",
              "dark:border-neutral-800 dark:bg-[#161b22]",
            ].join(" ")}
          >
            <button
              type="button"
              className={[
                "flex min-h-12 w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors sm:min-h-0 sm:px-5",
                "hover:bg-stone-100/80",
                "dark:hover:bg-neutral-900/50",
              ].join(" ")}
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-stone-900 dark:text-neutral-100">
                  Grammar explanation
                </span>
                <span
                  lang="my"
                  className="mt-0.5 block font-myanmar text-xs leading-5 text-stone-600 dark:text-neutral-400"
                >
                  သဒ္ဒါရှင်းလင်းချက်
                </span>
              </span>
              <span
                className={[
                  "grid size-10 shrink-0 place-items-center rounded-lg border text-stone-500 transition-all duration-300 ease-out sm:size-8",
                  "border-stone-200 bg-white",
                  "dark:border-neutral-700 dark:bg-[#0d1117] dark:text-neutral-400",
                  detailsOpen
                    ? "rotate-180 border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
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
                <div
                  className={[
                    "space-y-4 border-t p-5",
                    "border-stone-200",
                    "dark:border-neutral-800",
                  ].join(" ")}
                >
                  {question.correctReasonBurmese ? (
                    <section
                      className={[
                        "rounded-xl border p-4",
                        "border-emerald-200 bg-emerald-50/80",
                        "dark:border-emerald-500/30 dark:bg-emerald-950/40",
                      ].join(" ")}
                    >
                      <SectionHeader
                        title="Correct reason"
                        burmeseLabel="မှန်ကန်ရသည့်အကြောင်း"
                        titleClass="text-emerald-700 dark:text-emerald-400"
                        labelClass="text-emerald-800/70 dark:text-emerald-200/70"
                      />
                      <p
                        lang="my"
                        className="font-myanmar text-sm leading-relaxed break-words whitespace-pre-wrap text-emerald-900 dark:text-emerald-100/90"
                      >
                        {question.correctReasonBurmese}
                      </p>
                    </section>
                  ) : null}

                  {question.incorrectReasonsBurmese ? (
                    <section
                      className={[
                        "rounded-xl border p-4",
                        "border-stone-200 bg-stone-50",
                        "dark:border-neutral-800 dark:bg-neutral-900/60",
                      ].join(" ")}
                    >
                      <SectionHeader
                        title="Why others are wrong"
                        burmeseLabel="အခြားရွေးချယ်မှုများ မမှန်ရခြင်း"
                        titleClass="text-amber-800 dark:text-amber-400/90"
                        labelClass="text-stone-600 dark:text-neutral-400"
                      />
                      <IncorrectOptionsBlock text={question.incorrectReasonsBurmese} />
                    </section>
                  ) : null}

                  {question.syntaxBreakdown ? (
                    <section
                      className={[
                        "rounded-xl border p-4",
                        "border-indigo-100 bg-indigo-50/60",
                        "dark:border-indigo-500/20 dark:bg-indigo-950/30",
                      ].join(" ")}
                    >
                      <SectionHeader
                        title="Syntax breakdown"
                        burmeseLabel="ဝါကျဖွဲ့စည်းပုံ"
                        titleClass="text-indigo-700 dark:text-indigo-400"
                        labelClass="text-indigo-800/70 dark:text-indigo-200/60"
                      />
                      <SyntaxBlock text={question.syntaxBreakdown} />
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
