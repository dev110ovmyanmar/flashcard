"use client";

import { BookmarkPlus, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { FuriganaHover } from "@/components/furigana-hover";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { harvestMarkupReadings } from "@/lib/furigana";
import type { ScriptVocabItem } from "@/src/constants/scriptPrompt";
import { UI } from "@/src/constants/uiCopy";

const btnAction =
  [
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2",
    "border border-border/50 bg-transparent text-muted-foreground",
    "transition-all duration-200 ease-in-out",
    "hover:border-border/80 hover:bg-muted/40 hover:text-foreground",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
    "[&_svg:not([class*='size-'])]:size-3.5",
  ].join(" ");

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function ScriptVocabCard({
  item,
  saving,
  onSave,
}: {
  item: ScriptVocabItem;
  saving?: boolean;
  onSave?: () => void;
}) {
  const [explainOpen, setExplainOpen] = useState(false);

  const readings = useMemo(() => {
    const map: Record<string, string> = {};
    if (item.word.trim() && item.reading.trim()) map[item.word.trim()] = item.reading.trim();
    harvestMarkupReadings(item.example_sentence, map);
    harvestMarkupReadings(item.explanation_burmese, map);
    return map;
  }, [item.word, item.reading, item.example_sentence, item.explanation_burmese]);

  const hasBody = Boolean(item.meaning_burmese || item.example_sentence);
  /** Explain = Burmese translation of the “In the script” sentence. */
  const canExplainScript = Boolean(item.explanation_burmese?.trim());

  return (
    <>
      <article className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] transition-shadow duration-200 hover:shadow-sm dark:border-border/50 dark:ring-white/[0.03]">
        <header className="flex items-start gap-3 border-b border-border/50 bg-muted/15 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Badge className="rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide">
                語彙
              </Badge>
              {item.jlpt_level ? (
                <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] font-medium">
                  {item.jlpt_level}
                </Badge>
              ) : null}
            </div>
            <FuriganaHover
              text={item.word || "—"}
              reading={item.reading}
              readings={readings}
              lang="ja"
              className="block font-serif text-[1.2rem] leading-[1.65] font-semibold tracking-tight break-words text-foreground sm:text-[1.35rem] sm:leading-[1.6]"
            />
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
            {canExplainScript ? (
              <button
                type="button"
                className={`${btnAction} px-2.5 text-xs font-medium`}
                onClick={() => setExplainOpen(true)}
                aria-label="Burmese translation of the script sentence"
                title="Burmese translation"
              >
                <Sparkles aria-hidden />
                <span>Explain</span>
              </button>
            ) : null}
            {onSave ? (
              <button
                type="button"
                className={`${btnAction} size-8 px-0`}
                disabled={saving}
                onClick={onSave}
                aria-label="Add to flashcard"
                title="Add to flashcard"
              >
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : <BookmarkPlus aria-hidden />}
              </button>
            ) : null}
          </div>
        </header>

        {hasBody ? (
          <div className="flex flex-1 flex-col gap-4 p-4 sm:px-5 sm:py-4">
            {item.meaning_burmese ? (
              <section className="min-w-0">
                <SectionLabel>{UI.card.meaning}</SectionLabel>
                <p
                  lang="my"
                  className="mt-2 font-myanmar text-[14px] leading-[1.95] break-words text-foreground/90"
                >
                  {item.meaning_burmese}
                </p>
              </section>
            ) : null}

            {item.example_sentence ? (
              <section
                className={[
                  "min-w-0",
                  item.meaning_burmese ? "border-t border-border/40 pt-4 dark:border-white/[0.06]" : "",
                ].join(" ")}
              >
                <SectionLabel>{UI.card.inScript}</SectionLabel>
                <FuriganaHover
                  text={item.example_sentence}
                  readings={readings}
                  lang="ja"
                  className="mt-2 block font-serif text-[15px] leading-7 tracking-tight break-words text-foreground"
                />
              </section>
            ) : null}
          </div>
        ) : null}
      </article>

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader className="gap-1.5 pr-10 text-left">
            <DialogDescription className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Translation
            </DialogDescription>
            <DialogTitle className="sr-only">Burmese translation of the script sentence</DialogTitle>
          </DialogHeader>
          <p
            lang="my"
            className="font-myanmar text-[15px] leading-[1.95] break-words text-foreground/90"
          >
            {item.explanation_burmese}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
