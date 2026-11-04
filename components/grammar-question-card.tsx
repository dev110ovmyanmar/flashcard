"use client";

import { Check, ChevronDown, Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import { harvestMarkupReadings } from "@/lib/furigana";
import { splitGrammarQuestionText } from "@/lib/grammar-format";
import type { GrammarOptionRow, GrammarQuestion } from "@/src/constants/grammarPrompt";
import { UI } from "@/src/constants/uiCopy";

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
      {UI.card.correct}
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

/** Option example tip — opens on hover; trigger stays top-right. */
function ExampleInfoTip({
  exampleSentence,
  exampleBurmese,
  readings,
}: {
  exampleSentence: string;
  exampleBurmese: string;
  readings: Record<string, string>;
}) {
  const tipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const updatePosition = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const preferBelow = rect.top < 140;
    const tipWidth = Math.min(22 * 16, window.innerWidth - 24);
    const half = tipWidth / 2;
    const centerX = rect.left + rect.width / 2;
    setPlacement(preferBelow ? "below" : "above");
    setPos({
      top: preferBelow ? rect.bottom : rect.top,
      left: Math.min(window.innerWidth - half - 12, Math.max(half + 12, centerX)),
    });
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hideSoon = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const hideNow = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideNow();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updatePosition, hideNow]);

  const style: CSSProperties | undefined = pos
    ? {
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform:
          placement === "above"
            ? "translate(-50%, calc(-100% - 0.55rem))"
            : "translate(-50%, 0.55rem)",
      }
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={UI.card.example}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        className={[
          "inline-flex shrink-0 items-center justify-center p-0.5",
          "text-muted-foreground/80 transition-colors duration-150",
          "hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:rounded-sm",
          open ? "text-sky-700 dark:text-sky-300" : "",
        ].join(" ")}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {mounted && open && pos
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              style={style}
              onMouseEnter={show}
              onMouseLeave={hideSoon}
              className={[
                "z-[200] w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)]",
                "rounded-xl border border-border/70 bg-popover/97 px-3.5 py-3 shadow-lg backdrop-blur-sm",
                "dark:border-white/12 dark:bg-popover/95",
              ].join(" ")}
            >
              <div
                aria-hidden
                className={[
                  "pointer-events-none absolute left-1/2 size-2.5 -translate-x-1/2 rotate-45",
                  "border-border/70 bg-popover/97 dark:border-white/12 dark:bg-popover/95",
                  placement === "above"
                    ? "bottom-[-5px] border-r border-b"
                    : "top-[-5px] border-t border-l",
                ].join(" ")}
              />
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {UI.card.example}
              </p>
              {exampleSentence ? (
                <FuriganaHover
                  text={exampleSentence}
                  readings={readings}
                  className="mt-1.5 block max-w-full font-serif text-[14px] leading-6 tracking-tight break-words [overflow-wrap:anywhere] text-popover-foreground"
                />
              ) : null}
              {exampleBurmese ? (
                <ProseWithFurigana
                  text={exampleBurmese}
                  readings={readings}
                  className="mt-1.5 block max-w-full font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-muted-foreground"
                />
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
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
  const exampleSentence = row.example_sentence.trim();
  const exampleBurmese = row.example_burmese.trim();
  const hasExample = Boolean(exampleSentence || exampleBurmese);

  return (
    <div
      className={[
        "relative min-w-0 rounded-xl border px-4 py-3.5 transition-colors duration-200 sm:px-4 sm:py-4",
        correct
          ? [
              "border-emerald-300/70 border-l-[3px] border-l-emerald-500 bg-emerald-50/80",
              "dark:border-emerald-400/25 dark:border-l-emerald-400 dark:bg-emerald-500/[0.10]",
            ].join(" ")
          : "border-border/55 bg-card/50 dark:border-white/[0.07] dark:bg-white/[0.015]",
      ].join(" ")}
    >
      {hasExample ? (
        <div className="absolute top-3.5 right-3.5 z-10 sm:top-4 sm:right-4">
          <ExampleInfoTip
            exampleSentence={exampleSentence}
            exampleBurmese={exampleBurmese}
            readings={readings}
          />
        </div>
      ) : null}

      <div className={hasExample ? "min-w-0 pr-10" : "min-w-0"}>
        {correct ? (
          <div className="mb-2.5">
            <CorrectBadge />
          </div>
        ) : null}

        <p
          className={[
            "min-w-0 font-serif text-[1.05rem] leading-7 tracking-tight break-words [overflow-wrap:anywhere] sm:text-[1.1rem]",
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
              "mt-1.5 block min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere]",
              correct ? "text-emerald-800/80 dark:text-emerald-100/75" : "text-muted-foreground",
            ].join(" ")}
          />
        ) : null}

        {row.usage_burmese ? (
          <div className="mt-3 min-w-0">
            <SectionLabel>{UI.card.usage}</SectionLabel>
            <ProseWithFurigana
              text={row.usage_burmese}
              readings={readings}
              className="mt-1.5 block min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-muted-foreground"
            />
          </div>
        ) : null}
      </div>
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
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/50 dark:ring-white/[0.03]">
      {/* Header */}
      <div className="min-w-0 border-b border-border/50 bg-muted/15 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              {UI.card.correct} {question.correctAnswer}
            </Badge>
          ) : null}
        </div>

        {question.grammarPattern ? (
          <div className="mt-4 min-w-0">
            <SectionLabel>{UI.card.pattern}</SectionLabel>
            <FuriganaHover
              text={question.grammarPattern}
              readings={readings}
              className="mt-1.5 block min-w-0 font-serif text-[1.2rem] leading-[1.6] font-semibold tracking-tight break-words [overflow-wrap:anywhere] text-foreground sm:text-[1.35rem] sm:leading-[1.55]"
            />
            {question.grammar_meaning_burmese ? (
              <p
                lang="my"
                className="mt-1.5 min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-muted-foreground"
              >
                {question.grammar_meaning_burmese}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 min-w-0">
          <SectionLabel>{UI.card.question}</SectionLabel>
          <FuriganaHover
            text={stem}
            readings={readings}
            className="mt-1.5 block min-w-0 font-serif text-[1.02rem] leading-[1.7] tracking-tight break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground/95 sm:text-[1.08rem] sm:leading-[1.65]"
          />
        </div>
      </div>

      {/* Options */}
      <div className="min-w-0 space-y-3 p-3.5 sm:p-4">
        {orderedOptions.length > 0 ? (
          <div className="grid min-w-0 gap-2.5">
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
                  {UI.card.explanation}
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
                <div className="space-y-4 border-t border-border/40 px-4 pt-3.5 pb-4 dark:border-white/8">
                  {question.explanation_burmese ? (
                    <div>
                      <SectionLabel tone="sky">{UI.card.whyCorrect}</SectionLabel>
                      <ProseWithFurigana
                        text={question.explanation_burmese}
                        readings={readings}
                        className="mt-2 block font-myanmar text-[14px] leading-7 break-words text-muted-foreground"
                      />
                    </div>
                  ) : null}

                  {question.related_grammar_burmese ? (
                    <div className="border-t border-border/40 pt-3.5 dark:border-white/8">
                      <SectionLabel tone="amber">{UI.card.relatedGrammar}</SectionLabel>
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
