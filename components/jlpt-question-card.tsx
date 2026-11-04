"use client";

import { Check, ChevronDown, Info, X } from "lucide-react";
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
import { primaryMeaning } from "@/lib/jlpt-to-goi";
import type { JlptOptionRow, JlptQuestion } from "@/src/constants/jlptPrompt";
import { UI } from "@/src/constants/uiCopy";

function isCorrectOption(option: string, correct: string): boolean {
  return option.trim() !== "" && option.trim() === correct.trim();
}

/**
 * Line 2 under the headword: short Burmese dictionary gloss —
 * never a stem-sentence translation, never the Kanji again.
 */
export function resolveTargetMeaningLine(question: JlptQuestion): string {
  const headword = question.target_word.trim();
  const fromQuestion = primaryMeaning(question.meaning_burmese);
  if (fromQuestion && fromQuestion !== headword) return fromQuestion;

  const correct = question.options_table.find((row) =>
    isCorrectOption(row.option, question.correct_option),
  );
  const fromOption = primaryMeaning(correct?.meaning_burmese);
  if (fromOption && fromOption !== headword) return fromOption;

  return "";
}

/** True when the stem is only the headword (or a Mondai 6 用法 dump we should hide). */
function shouldHideStem(question: JlptQuestion): boolean {
  const stem = question.japanese_sentence.trim();
  const target = question.target_word.trim();
  if (!stem) return true;
  if (target && stem === target) return true;
  // Numbered multi-sentence dump already collapsed by parser, but hide leftovers.
  if ((stem.match(/[。．]/g) ?? []).length >= 2) return true;
  if (/\d\s*[.．]/.test(stem) && stem.length > 40) return true;
  return false;
}

/** True when option japanese is a usage sentence (Mondai 6), not a headword. */
export function isOptionSentence(japanese: string, mondaiType?: number): boolean {
  if (mondaiType === 6) return true;
  const text = japanese.trim();
  if (!text) return false;
  if (/[。．？！?!]/.test(text)) return true;
  return Array.from(text.replace(/\s/g, "")).length >= 18;
}

/** Collect every known headword → reading from the analyzed question + prose markup. */
export function buildQuestionReadings(question: JlptQuestion): Record<string, string> {
  const map: Record<string, string> = {};

  for (const token of question.furigana_tokens) {
    const surface = token.surface.trim();
    const reading = token.reading.trim();
    if (surface && reading) map[surface] = reading;
  }

  const target = question.target_word.trim();
  const targetReading = question.reading.trim();
  if (target && targetReading) map[target] = targetReading;

  for (const row of question.options_table) {
    const surface = row.japanese.trim();
    const reading = row.reading.trim();
    // Never map a full 用例 sentence → one reading (breaks per-kanji hover).
    if (surface && reading && !isOptionSentence(surface, question.mondai_type)) {
      map[surface] = reading;
    }

    harvestMarkupReadings(row.japanese, map);
    harvestMarkupReadings(row.meaning_burmese, map);
    harvestMarkupReadings(row.usage_burmese, map);
    harvestMarkupReadings(row.sentence_burmese ?? "", map);
    harvestMarkupReadings(row.why_wrong_burmese, map);
  }

  harvestMarkupReadings(question.explanation_burmese, map);
  harvestMarkupReadings(question.nuance_note, map);
  harvestMarkupReadings(question.japanese_sentence, map);

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

function clampTipLeft(anchorCenterX: number, tipMaxWidthRem = 22) {
  const tipWidth = Math.min(tipMaxWidthRem * 16, window.innerWidth - 24);
  const half = tipWidth / 2;
  return Math.min(window.innerWidth - half - 12, Math.max(half + 12, anchorCenterX));
}

/** Mondai 6: tip for the full-sentence Burmese explanation (matches grammar info icon). */
function SentenceInfoTip({
  text,
  readings,
}: {
  text: string;
  readings: Record<string, string>;
}) {
  const tipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const preferBelow = rect.top < 140;
    setPlacement(preferBelow ? "below" : "above");
    setPos({
      top: preferBelow ? rect.bottom : rect.top,
      left: clampTipLeft(rect.left + rect.width / 2),
    });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updatePosition, hide]);

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
        aria-label={UI.card.sentenceAria}
        aria-expanded={open}
        aria-controls={open ? tipId : undefined}
        className={[
          "inline-flex shrink-0 items-center justify-center p-0.5",
          "text-muted-foreground/80 transition-colors duration-150",
          "hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:rounded-sm",
          open ? "text-sky-700 dark:text-sky-300" : "",
        ].join(" ")}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) hide();
          else show();
        }}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {mounted && open && pos
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="dialog"
              aria-label={UI.card.sentence}
              style={style}
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
                {UI.card.sentence}
              </p>
              <ProseWithFurigana
                text={text}
                readings={readings}
                className="mt-1.5 block max-w-full font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-popover-foreground"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function OptionJapanese({
  japanese,
  reading,
  readings,
  sentenceMode,
  className,
}: {
  japanese: string;
  reading?: string;
  readings: Record<string, string>;
  sentenceMode?: boolean;
  className?: string;
}) {
  return (
    <FuriganaHover
      text={japanese || "—"}
      reading={sentenceMode ? undefined : reading}
      readings={readings}
      className={className}
    />
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

function MobileOptionCard({
  row,
  correct,
  zebra,
  readings,
  sentenceMode,
}: {
  row: JlptOptionRow;
  correct: boolean;
  zebra: boolean;
  readings: Record<string, string>;
  sentenceMode?: boolean;
}) {
  const sentenceMeaning = (row.sentence_burmese ?? "").trim();
  const hasTip = Boolean(sentenceMeaning);

  return (
    <div
      className={[
        "relative min-w-0 rounded-lg border px-3.5 py-3 transition-colors duration-200",
        correct
          ? "border-emerald-300/60 dark:border-emerald-400/25"
          : "border-border/50",
        optionRowClass(correct, zebra),
      ].join(" ")}
    >
      {hasTip ? (
        <div className="absolute top-3 right-3 z-10">
          <SentenceInfoTip text={sentenceMeaning} readings={readings} />
        </div>
      ) : null}

      <div className={hasTip ? "min-w-0 pr-10" : "min-w-0"}>
        {correct ? (
          <div className="mb-2">
            <CorrectBadge />
          </div>
        ) : null}
        <p
          className={[
            "min-w-0 font-serif text-[1.05rem] leading-7 tracking-tight break-words [overflow-wrap:anywhere]",
            correct
              ? "font-semibold text-emerald-950 dark:text-emerald-50"
              : "font-medium text-foreground",
          ].join(" ")}
        >
          <OptionJapanese
            japanese={row.japanese}
            reading={row.reading}
            readings={readings}
            sentenceMode={sentenceMode}
          />
        </p>
        {row.meaning_burmese ? (
          <ProseWithFurigana
            text={row.meaning_burmese}
            readings={readings}
            className={[
              "mt-1.5 block min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere]",
              correct
                ? "text-emerald-800/80 dark:text-emerald-100/75"
                : "text-muted-foreground",
            ].join(" ")}
          />
        ) : null}
        {row.usage_burmese ? (
          <ProseWithFurigana
            text={row.usage_burmese}
            readings={readings}
            className="mt-1.5 block min-w-0 font-myanmar text-[12px] leading-5 break-words [overflow-wrap:anywhere] text-muted-foreground/90"
          />
        ) : null}
      </div>
    </div>
  );
}

function DistractorCard({
  row,
  readings,
  sentenceMode,
}: {
  row: JlptOptionRow;
  readings: Record<string, string>;
  sentenceMode?: boolean;
}) {
  const hasBody = Boolean(row.usage_burmese || row.why_wrong_burmese);

  const sentenceMeaning = (row.sentence_burmese ?? "").trim();
  const hasTip = Boolean(sentenceMeaning);

  return (
    <section className="relative min-w-0 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-3.5 py-3 dark:border-rose-400/15 dark:bg-rose-400/[0.05]">
      {hasTip ? (
        <div className="absolute top-3 right-3 z-10">
          <SentenceInfoTip text={sentenceMeaning} readings={readings} />
        </div>
      ) : null}
      <div className={hasTip ? "min-w-0 pr-10" : "min-w-0"}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/60 bg-rose-100/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/12 dark:text-rose-200">
            <X className="size-2.5" aria-hidden />
            {UI.card.wrong}
          </span>
          <span className="min-w-0 font-serif text-[15px] font-medium tracking-tight break-words [overflow-wrap:anywhere] text-foreground">
            <OptionJapanese
              japanese={row.japanese}
              reading={row.reading}
              readings={readings}
              sentenceMode={sentenceMode}
            />
          </span>
        </div>
        {hasBody ? (
          <dl className="mt-2.5 space-y-2">
            {row.usage_burmese ? (
              <div className="min-w-0">
                <SectionLabel>{UI.card.usageContext}</SectionLabel>
                <dd className="mt-1">
                  <ProseWithFurigana
                    text={row.usage_burmese}
                    readings={readings}
                    className="min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-muted-foreground"
                  />
                </dd>
              </div>
            ) : null}
            {row.why_wrong_burmese ? (
              <div className="min-w-0">
                <SectionLabel tone="rose">{UI.card.whyWrong}</SectionLabel>
                <dd className="mt-1">
                  <ProseWithFurigana
                    text={row.why_wrong_burmese}
                    readings={readings}
                    className="min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-muted-foreground"
                  />
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

export function JlptQuestionCard({ question }: { question: JlptQuestion }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();
  const readings = useMemo(() => buildQuestionReadings(question), [question]);
  const targetMeaningLine = useMemo(() => resolveTargetMeaningLine(question), [question]);
  const hideStem = shouldHideStem(question);
  const headword = question.target_word.trim();
  /** Mondai 1 (漢字読み) / Mondai 2 (表記): underline the asked word in the stem. */
  const highlightTarget = useMemo(() => {
    if ((question.mondai_type !== 1 && question.mondai_type !== 2) || !headword) return null;
    const candidates = [headword];
    const kana = question.reading.trim();
    // Mondai 2 often prints the target in kana in the stem.
    if (kana) candidates.push(kana);
    // Token pieces that make up the target (e.g. 計 + 画 for 計画).
    for (const token of question.furigana_tokens) {
      const surface = token.surface.trim();
      if (!surface) continue;
      if (
        surface === headword ||
        surface === kana ||
        (surface.length < headword.length && headword.includes(surface))
      ) {
        candidates.push(surface);
      }
    }
    return candidates;
  }, [question.mondai_type, question.furigana_tokens, question.reading, headword]);
  const distractors = question.options_table.filter(
    (row) => !isCorrectOption(row.option, question.correct_option),
  );
  const isMondai6 = question.mondai_type === 6;
  const hasDistractorDetail = distractors.some(
    (row) =>
      row.usage_burmese ||
      row.why_wrong_burmese ||
      row.sentence_burmese,
  );
  const hasDetails = Boolean(
    question.explanation_burmese || question.nuance_note || hasDistractorDetail,
  );

  return (
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/50 dark:ring-white/[0.03]">
      <div className="border-b border-border/50 bg-muted/15 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide">
            問題{question.mondai_type}
          </Badge>
          <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
            Q{question.question_number}
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

        {/* Line 1: headword (or unique stem when it differs) */}
        {hideStem && headword ? (
          <FuriganaHover
            text={headword}
            reading={question.reading}
            readings={readings}
            highlight={highlightTarget}
            className="mt-3 block min-w-0 font-serif text-[1.05rem] leading-[1.65] tracking-tight break-words [overflow-wrap:anywhere] text-foreground sm:text-lg sm:leading-[1.6]"
          />
        ) : (
          <FuriganaHover
            text={question.japanese_sentence || headword || "—"}
            tokens={hideStem ? undefined : question.furigana_tokens}
            reading={hideStem ? question.reading : undefined}
            readings={readings}
            highlight={highlightTarget}
            className="mt-3 block min-w-0 font-serif text-[1.05rem] leading-[1.65] tracking-tight break-words [overflow-wrap:anywhere] text-foreground sm:text-lg sm:leading-[1.6]"
          />
        )}

        {/* Line 2: short Myanmar meaning — never repeat the kanji */}
        {targetMeaningLine ? (
          <p
            lang="my"
            className="mt-1.5 min-w-0 font-myanmar text-[13px] leading-6 break-words [overflow-wrap:anywhere] text-foreground/80"
          >
            {targetMeaningLine}
          </p>
        ) : question.reading && hideStem ? (
          <p className="mt-1.5 min-w-0 text-sm tracking-[0.06em] break-words [overflow-wrap:anywhere] text-muted-foreground">
            {question.reading}
          </p>
        ) : !hideStem && headword && headword !== question.japanese_sentence.trim() ? (
          <p className="mt-2 min-w-0 text-sm font-medium break-words [overflow-wrap:anywhere] text-foreground/85">
            <FuriganaHover
              text={headword}
              reading={question.reading}
              readings={readings}
            />
          </p>
        ) : null}
      </div>

      <div className="min-w-0 p-3.5 sm:p-4">
        {question.options_table.length > 0 ? (
          <>
            <div className="grid min-w-0 gap-2 sm:hidden">
              {question.options_table.map((row, index) => {
                const correct = isCorrectOption(row.option, question.correct_option);
                return (
                  <MobileOptionCard
                    key={`${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}-m`}
                    row={row}
                    correct={correct}
                    zebra={index % 2 === 1}
                    readings={readings}
                    sentenceMode={isMondai6}
                  />
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-border/55 dark:border-white/8 sm:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[42%]" />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-border/50 bg-muted/35">
                    <th className="px-3.5 py-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {isMondai6 ? UI.card.exampleUse : UI.card.kanji}
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
                    const sentenceMeaning = (row.sentence_burmese ?? "").trim();
                    return (
                      <tr
                        key={`${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}`}
                        className={[
                          "border-t border-border/40 transition-colors duration-150",
                          optionRowClass(correct, zebra),
                        ].join(" ")}
                      >
                        <td className="min-w-0 px-3.5 py-3 align-middle">
                          <div className="flex min-w-0 items-start gap-2">
                            <div
                              className={[
                                "min-w-0 flex-1 font-serif text-[15px] leading-7 tracking-tight break-words [overflow-wrap:anywhere]",
                                correct
                                  ? "font-semibold text-emerald-950 dark:text-emerald-50"
                                  : "font-medium text-foreground",
                              ].join(" ")}
                            >
                              <OptionJapanese
                                japanese={row.japanese}
                                reading={row.reading}
                                readings={readings}
                                sentenceMode={isMondai6}
                              />
                            </div>
                            {sentenceMeaning ? (
                              <div className="mt-0.5 shrink-0">
                                <SentenceInfoTip text={sentenceMeaning} readings={readings} />
                              </div>
                            ) : null}
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
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <ProseWithFurigana
                                text={row.meaning_burmese || "—"}
                                readings={readings}
                                className="block"
                              />
                              {row.usage_burmese ? (
                                <ProseWithFurigana
                                  text={row.usage_burmese}
                                  readings={readings}
                                  className="mt-1 block text-[12px] leading-5 opacity-85"
                                />
                              ) : null}
                            </div>
                            {correct ? (
                              <div className="mt-0.5 shrink-0">
                                <CorrectBadge />
                              </div>
                            ) : null}
                          </div>
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
                  {question.nuance_note ? (
                    <section className="rounded-lg border border-amber-500/35 bg-amber-50/80 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-950/20">
                      <SectionLabel tone="amber">{UI.card.nuanceContext}</SectionLabel>
                      <ProseWithFurigana
                        text={question.nuance_note}
                        readings={readings}
                        className="mt-2 block font-myanmar text-[14px] leading-7 break-words text-amber-950/85 dark:text-amber-50/90"
                      />
                    </section>
                  ) : null}
                  {hasDistractorDetail ? (
                    <section className="space-y-2">
                      <SectionLabel tone="rose">{UI.card.wrongOptions}</SectionLabel>
                      <div className="grid gap-2">
                        {distractors.map((row) => (
                          <DistractorCard
                            key={`d-${question.mondai_type}-${question.question_number}-${row.option}-${row.japanese}`}
                            row={row}
                            readings={readings}
                            sentenceMode={isMondai6}
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
