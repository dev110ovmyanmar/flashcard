"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Card } from "@/lib/types";

function kanjiClass(text: string): string {
  const length = Array.from(text).length;
  if (length <= 2) return "text-7xl sm:text-8xl";
  if (length <= 4) return "text-6xl sm:text-7xl";
  if (length <= 6) return "text-5xl sm:text-6xl";
  return "text-4xl sm:text-5xl";
}

export function FlashCard({
  card,
  deckName,
  flipped,
  onFlip,
}: {
  card: Card;
  deckName: string;
  flipped: boolean;
  onFlip: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? `Hide the answer for ${card.kanji}` : `Show the reading and meaning for ${card.kanji}`}
      onClick={onFlip}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onFlip();
        }
      }}
      className="flip-scene h-full w-full cursor-pointer rounded-[1.75rem] text-left select-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <motion.div
        className="flip-inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0.01 } : { type: "spring", stiffness: 170, damping: 22, mass: 0.85 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="flip-face flip-face-front card-wash border border-border shadow-[0_30px_70px_-28px_color-mix(in_oklab,var(--foreground)_35%,transparent)]" aria-hidden={flipped}>
          <span className="absolute inset-x-10 top-0 h-1 rounded-b-full bg-primary/80" />
          <div className="flex h-full w-full flex-col items-center justify-between px-6 py-8 sm:px-10">
            <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{deckName}</p>
            <p lang="ja" className={`font-serif leading-none tracking-tight text-foreground ${kanjiClass(card.kanji)}`}>
              {card.kanji}
            </p>
            <p className="text-sm text-muted-foreground">Tap to reveal</p>
          </div>
        </div>

        <div className="flip-face flip-face-back card-wash border border-border shadow-[0_30px_70px_-28px_color-mix(in_oklab,var(--foreground)_35%,transparent)]" aria-hidden={!flipped}>
          <span className="absolute inset-x-10 top-0 h-1 rounded-b-full bg-moss/80" />
          <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-8 text-center sm:px-10">
            <p lang="ja" className="font-serif text-lg text-muted-foreground">
              {card.kanji}
            </p>
            <div>
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Reading</p>
              <p lang="ja" className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">
                {card.reading || "—"}
              </p>
            </div>
            <div className="w-full max-w-sm">
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Myanmar</p>
              <p lang="my" className="mt-2 font-myanmar text-2xl leading-[1.7] sm:text-3xl">
                {card.meaning || "—"}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="absolute right-5 bottom-5 grid size-12 place-items-center rounded-full border border-primary/40 font-serif text-base text-primary/70 rotate-12"
            >
              習
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
