"use client";

import { Languages } from "lucide-react";
import { useMemo, useState } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);

  const readings = useMemo(() => {
    const map: Record<string, string> = {};
    harvestMarkupReadings(scriptText, map);
    return map;
  }, [scriptText]);

  const hasTranslation = translationBurmese.trim().length > 0;

  if (!scriptText.trim()) return null;

  return (
    <>
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
          <div className="flex items-center gap-2.5 px-4 pt-4 sm:px-7 sm:pt-6">
            <span className="size-1.5 shrink-0 rounded-full bg-moss/80 dark:bg-moss/70" aria-hidden />
            <SectionLabel>{UI.results.script}</SectionLabel>
          </div>

          <div className="relative px-4 pt-3 pb-4 sm:px-7 sm:pt-5 sm:pb-5">
            <FuriganaHover
              text={scriptText}
              readings={readings}
              lang="ja"
              className={[
                "block w-full min-w-0 font-serif whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                "text-[1.02rem] leading-[2.05] tracking-[0.015em] text-foreground/95",
                "sm:text-[1.12rem] sm:leading-[2.15]",
                "dark:text-foreground/92",
              ].join(" ")}
            />
          </div>

          {hasTranslation ? (
            <div className="border-t border-border/45 px-3 py-3 sm:px-5 sm:py-3.5 dark:border-white/[0.07]">
              <button
                type="button"
                aria-label={UI.results.translationAria}
                className={[
                  "flex h-11 w-full items-center justify-center gap-2 rounded-xl px-3",
                  "border border-border/60 bg-background/90 text-sm font-medium text-foreground",
                  "shadow-none transition-all duration-200",
                  "hover:bg-muted/60 active:scale-[0.985]",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  "sm:h-10 sm:text-xs",
                  "[&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
                ].join(" ")}
                onClick={() => setOpen(true)}
              >
                <Languages aria-hidden />
                <span>{UI.results.translation}</span>
              </button>
            </div>
          ) : null}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className={[
            "gap-0 overflow-hidden p-0",
            "max-sm:max-h-[min(88dvh,100%)]",
            "sm:max-w-lg sm:gap-0",
          ].join(" ")}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              aria-hidden
              className="mx-auto mt-2.5 hidden h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 max-sm:block"
            />

            <DialogHeader className="gap-1 px-5 pt-4 pr-14 pb-3 text-left sm:px-6 sm:pt-6 sm:pr-14">
              <DialogDescription className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {UI.results.script}
              </DialogDescription>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {UI.results.translation}
              </DialogTitle>
            </DialogHeader>

            <div
              className={[
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                "border-t border-border/50 bg-muted/15",
                "px-5 py-4 sm:px-6 sm:py-5",
                "max-sm:max-h-[min(68dvh,calc(88dvh-7.5rem))]",
                "sm:max-h-[min(28rem,60vh)]",
                "dark:border-white/[0.07] dark:bg-muted/10",
              ].join(" ")}
            >
              <p
                lang="my"
                className={[
                  "font-myanmar text-[15px] leading-[2] text-foreground/92",
                  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                  "sm:text-[14px] sm:leading-[1.95]",
                ].join(" ")}
              >
                {translationBurmese}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
