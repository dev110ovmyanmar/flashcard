"use client";

import { BookmarkPlus, ChevronDown, Loader2 } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import { harvestMarkupReadings } from "@/lib/furigana";
import type { ScriptGrammarItem } from "@/src/constants/scriptPrompt";

/** 4/8px-grid icon action — tactile save control */
const btnSave =
  [
    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
    "border border-border/60 bg-card/95 text-foreground/80 shadow-xs",
    "transition-all duration-200 ease-in-out",
    "hover:border-border hover:bg-muted/70 hover:text-foreground hover:shadow-sm",
    "active:scale-[0.94] active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "[&_svg:not([class*='size-'])]:size-3.5",
  ].join(" ");

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] leading-4 font-semibold tracking-[0.14em] text-sky-800/75 uppercase dark:text-sky-300/80">
      {children}
    </h3>
  );
}

function DetailBlock({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "correct";
}) {
  const isCorrect = tone === "correct";
  return (
    <section
      className={[
        "rounded-lg border px-3 py-2.5 transition-all duration-200 ease-in-out",
        isCorrect
          ? [
              "border-emerald-300/60 border-l-[3px] border-l-emerald-500/90 bg-emerald-50/80",
              "dark:border-emerald-400/25 dark:border-l-emerald-400 dark:bg-emerald-500/[0.10]",
            ].join(" ")
          : [
              "border-border/45 bg-card/80",
              "shadow-[inset_0_1px_0_color-mix(in_oklab,white_55%,transparent)]",
              "dark:border-white/[0.07] dark:bg-black/20 dark:shadow-none",
            ].join(" "),
      ].join(" ")}
    >
      {isCorrect ? (
        <h3 className="text-[10px] leading-4 font-semibold tracking-[0.14em] text-emerald-800/80 uppercase dark:text-emerald-200/85">
          {label}
        </h3>
      ) : (
        <SectionLabel>{label}</SectionLabel>
      )}
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function MyanmarProse({
  text,
  readings,
  secondary = false,
}: {
  text: string;
  readings: Record<string, string>;
  secondary?: boolean;
}) {
  if (!text.trim()) return null;
  return (
    <FuriganaHover
      text={text}
      readings={readings}
      lang="my"
      className={[
        "block font-myanmar break-words",
        secondary
          ? "text-[13px] leading-[1.9] text-muted-foreground"
          : "text-[14px] leading-[1.9] text-foreground/80",
      ].join(" ")}
    />
  );
}

function JapaneseProse({
  text,
  readings,
  correct = false,
}: {
  text: string;
  readings: Record<string, string>;
  correct?: boolean;
}) {
  if (!text.trim()) return null;
  return (
    <FuriganaHover
      text={text}
      readings={readings}
      lang="ja"
      className={[
        "block font-serif text-[15px] leading-7 tracking-tight break-words",
        correct
          ? "font-semibold text-emerald-950 dark:text-emerald-50"
          : "text-foreground",
      ].join(" ")}
    />
  );
}

export function ScriptGrammarCard({
  item,
  saving,
  onSave,
}: {
  item: ScriptGrammarItem;
  saving?: boolean;
  onSave?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panelId = useId();

  const readings = useMemo(() => {
    const map: Record<string, string> = {};
    harvestMarkupReadings(item.pattern, map);
    harvestMarkupReadings(item.usage_in_script, map);
    harvestMarkupReadings(item.explanation_burmese, map);
    harvestMarkupReadings(item.usage_burmese, map);
    harvestMarkupReadings(item.nuance_burmese, map);
    harvestMarkupReadings(item.context_example, map);
    if (item.pattern.trim() && item.reading.trim()) {
      const plain = item.pattern.replace(/《[^》]*》/g, "").trim();
      if (plain) map[plain] = item.reading.trim();
    }
    return map;
  }, [item]);

  const hasDetails = Boolean(
    item.explanation_burmese ||
      item.usage_in_script ||
      item.usage_burmese ||
      item.nuance_burmese ||
      item.context_example,
  );

  return (
    <article
      className={[
        "group w-full overflow-hidden rounded-xl",
        "border border-border/55 bg-card/95",
        "shadow-xs ring-1 ring-black/[0.025]",
        "transition-all duration-200 ease-in-out",
        "hover:border-border/75 hover:shadow-md hover:ring-black/[0.04]",
        "dark:border-border/45 dark:ring-white/[0.035]",
        "dark:hover:border-border/65 dark:hover:ring-white/[0.05]",
      ].join(" ")}
    >
      {/* Primary surface — pattern commands attention */}
      <header className="border-b border-border/45 bg-gradient-to-b from-muted/25 to-muted/10 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <Badge className="h-5 rounded-md px-1.5 text-[10px] font-semibold tracking-[0.08em]">
              文法
            </Badge>
            {item.jlpt_level ? (
              <Badge
                variant="secondary"
                className="h-5 rounded-md px-1.5 text-[10px] font-medium tracking-wide text-muted-foreground tabular-nums"
              >
                {item.jlpt_level}
              </Badge>
            ) : null}
          </div>
          {onSave ? (
            <button
              type="button"
              className={btnSave}
              disabled={saving}
              onClick={onSave}
              aria-label="Add to flashcard"
              title="Add to flashcard"
            >
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <BookmarkPlus aria-hidden />}
            </button>
          ) : null}
        </div>

        <h2 className="mt-3 min-w-0">
          <FuriganaHover
            text={item.pattern || "—"}
            readings={readings}
            lang="ja"
            className="block font-serif text-[1.125rem] leading-[1.75] font-semibold tracking-tight break-words text-foreground sm:text-[1.25rem] sm:leading-[1.7]"
          />
        </h2>
        {item.reading ? (
          <p className="mt-1 text-xs leading-5 tracking-[0.02em] text-muted-foreground/90">
            {item.reading}
          </p>
        ) : null}
      </header>

      {hasDetails ? (
        <div className="p-3 sm:p-4">
          <div
            className={[
              "overflow-hidden rounded-lg border",
              "transition-all duration-200 ease-in-out",
              detailsOpen
                ? "border-sky-600/20 bg-sky-500/[0.035] dark:border-sky-400/18 dark:bg-sky-400/[0.045]"
                : "border-dashed border-border/50 bg-muted/15 dark:border-white/10 dark:bg-white/[0.02]",
            ].join(" ")}
          >
            <button
              type="button"
              className={[
                "flex w-full min-h-11 items-center justify-between gap-3 px-3 py-2.5 text-left sm:min-h-10 sm:px-3.5 sm:py-3",
                "transition-all duration-200 ease-in-out",
                "hover:bg-black/[0.02] active:bg-black/[0.03]",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset",
                "dark:hover:bg-white/[0.03]",
              ].join(" ")}
              aria-expanded={detailsOpen}
              aria-controls={panelId}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span className="min-w-0 pr-1">
                <span className="block text-[13px] leading-5 font-semibold tracking-tight text-foreground">
                  Explanation & Context
                </span>
                <span
                  lang="my"
                  className="mt-0.5 block font-myanmar text-[11px] leading-4 text-muted-foreground"
                >
                  အသေးစိတ် ရှင်းလင်းချက် နှင့် အသုံးအနှုန်း
                </span>
              </span>
              <span
                className={[
                  "grid size-7 shrink-0 place-items-center rounded-md border",
                  "bg-background/90 text-muted-foreground shadow-xs",
                  "transition-all duration-200 ease-in-out",
                  "dark:bg-background/50",
                  detailsOpen
                    ? "rotate-180 border-sky-600/30 text-sky-800 dark:border-sky-400/30 dark:text-sky-300"
                    : "border-border/55 dark:border-white/10",
                ].join(" ")}
                aria-hidden
              >
                <ChevronDown className="size-3.5" />
              </span>
            </button>

            <div
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-2 border-t border-border/35 px-2.5 pt-2.5 pb-3 sm:space-y-2 sm:px-3 sm:pt-3 sm:pb-3.5 dark:border-white/[0.06]">
                  {item.explanation_burmese ? (
                    <DetailBlock label="Explanation">
                      <MyanmarProse text={item.explanation_burmese} readings={readings} />
                    </DetailBlock>
                  ) : null}

                  {item.usage_in_script || item.usage_burmese ? (
                    <DetailBlock label="In the script" tone="correct">
                      <JapaneseProse text={item.usage_in_script} readings={readings} correct />
                      {item.usage_burmese ? (
                        <FuriganaHover
                          text={item.usage_burmese}
                          readings={readings}
                          lang="my"
                          className="block font-myanmar text-[13px] leading-[1.9] break-words text-emerald-800/80 dark:text-emerald-100/75"
                        />
                      ) : null}
                    </DetailBlock>
                  ) : null}

                  {item.nuance_burmese ? (
                    <DetailBlock label="Nuance">
                      <MyanmarProse text={item.nuance_burmese} readings={readings} />
                    </DetailBlock>
                  ) : null}

                  {item.context_example ? (
                    <DetailBlock label="ဥပမာ အသုံး">
                      <JapaneseProse text={item.context_example} readings={readings} />
                    </DetailBlock>
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
