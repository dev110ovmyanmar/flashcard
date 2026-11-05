"use client";

import { ChevronDown, Languages } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { harvestMarkupReadings } from "@/lib/furigana";
import { UI } from "@/src/constants/uiCopy";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

type ScriptContentCardProps = {
  scriptText: string;
  translationBurmese: string;
};

export function ScriptContentCard({ scriptText, translationBurmese }: ScriptContentCardProps) {
  const panelId = useId();
  const [translationOpen, setTranslationOpen] = useState(false);

  const readings = useMemo(() => {
    const map: Record<string, string> = {};
    harvestMarkupReadings(scriptText, map);
    return map;
  }, [scriptText]);

  const hasTranslation = translationBurmese.trim().length > 0;

  if (!scriptText.trim()) return null;

  return (
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
        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-1.5 shrink-0 rounded-full bg-moss/80 dark:bg-moss/70" aria-hidden />
            <SectionLabel>{UI.results.script}</SectionLabel>
          </div>

          {hasTranslation ? (
            <button
              type="button"
              aria-expanded={translationOpen}
              aria-controls={panelId}
              aria-label={UI.results.translationAria}
              className={[
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5",
                "border border-border/60 bg-background/80 text-xs font-medium text-foreground shadow-none",
                "transition-all duration-200",
                "hover:bg-muted/60 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                translationOpen
                  ? "border-moss/35 bg-moss/[0.08] text-foreground dark:border-moss/40 dark:bg-moss/15"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              onClick={() => setTranslationOpen((open) => !open)}
            >
              <Languages className="size-3.5" aria-hidden />
              <span>{UI.results.translation}</span>
              <ChevronDown
                aria-hidden
                className={[
                  "size-3.5 transition-transform duration-200",
                  translationOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
          ) : null}
        </div>

        <div className="relative px-5 pt-4 pb-5 sm:px-7 sm:pt-5 sm:pb-6">
          <FuriganaHover
            text={scriptText}
            readings={readings}
            lang="ja"
            className={[
              "block w-full min-w-0 font-serif whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
              "text-[1.05rem] leading-[2.05] tracking-[0.015em] text-foreground/95",
              "sm:text-[1.12rem] sm:leading-[2.15]",
              "dark:text-foreground/92",
            ].join(" ")}
          />
        </div>

        {hasTranslation ? (
          <div
            id={panelId}
            role="region"
            aria-label={UI.results.translation}
            aria-hidden={!translationOpen}
            className={[
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              translationOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
            ].join(" ")}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="border-t border-border/45 bg-muted/20 px-5 py-4 sm:px-7 sm:py-5 dark:border-white/[0.07] dark:bg-muted/10">
                <SectionLabel>{UI.results.translation}</SectionLabel>
                <p
                  lang="my"
                  className={[
                    "mt-3 max-h-[min(22rem,52vh)] overflow-y-auto overscroll-contain",
                    "font-myanmar text-[14px] leading-[1.95] text-foreground/90",
                    "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                    "pr-1 [scrollbar-gutter:stable]",
                  ].join(" ")}
                >
                  {translationBurmese}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
