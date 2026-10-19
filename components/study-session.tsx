"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/confetti";
import { FlashCard } from "@/components/flash-card";
import { Button } from "@/components/ui/button";
import { isWeak } from "@/lib/srs";
import type { Card, Deck, Grade } from "@/lib/types";

type Mode = "all" | "mistakes";
type Phase = "study" | "done" | "empty";

type Session = {
  queue: string[];
  order: string[];
  mastered: string[];
  repeats: Record<string, number>;
  phase: Phase;
};

type History = {
  card: Card;
  session: Session;
};

function startSession(deck: Deck, mode: Mode): Session {
  const cards = mode === "mistakes" ? deck.cards.filter(isWeak) : deck.cards;
  const ids = cards.map((card) => card.id);
  return {
    queue: ids,
    order: ids,
    mastered: [],
    repeats: {},
    phase: ids.length ? "study" : "empty",
  };
}

export function StudySession({
  deck,
  onGrade,
  onRestoreCard,
}: {
  deck: Deck;
  onGrade: (cardId: string, grade: Grade) => void;
  onRestoreCard: (card: Card) => void;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [session, setSession] = useState<Session>(() => startSession(deck, "all"));
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState(1);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<History | null>(null);
  const lock = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  function changeMode(next: Mode) {
    if (next === mode && session.phase === "study") return;
    setMode(next);
    setSession(startSession(deck, next));
    setFlipped(false);
    setHistory(null);
    setTick((value) => value + 1);
  }

  const weakCount = deck.cards.filter(isWeak).length;
  const current = deck.cards.find((card) => card.id === session.queue[0]) ?? null;
  const total = session.order.length;
  const position = current ? Math.max(1, session.order.indexOf(current.id) + 1) : total;
  const repeat = current ? (session.repeats[current.id] ?? 0) > 0 : false;
  const progress = total === 0 ? 0 : Math.round((session.mastered.length / total) * 100);

  function revealOr(grade: Grade) {
    if (!flipped) {
      setFlipped(true);
      return;
    }
    commitGrade(grade);
  }

  function commitGrade(grade: Grade) {
    if (!current || lock.current || session.phase !== "study") return;
    lock.current = true;
    window.setTimeout(() => {
      lock.current = false;
    }, 320);

    const snapshot = current;
    setHistory({ card: snapshot, session });
    onGrade(snapshot.id, grade);
    setDirection(grade === "easy" ? 1 : -1);
    setFlipped(false);
    setTick((value) => value + 1);
    setSession((currentSession) => {
      if (grade === "easy") {
        const queue = currentSession.queue.slice(1);
        const mastered = currentSession.mastered.includes(snapshot.id)
          ? currentSession.mastered
          : [...currentSession.mastered, snapshot.id];
        return {
          ...currentSession,
          queue,
          mastered,
          phase: queue.length ? "study" : "done",
        };
      }
      return {
        ...currentSession,
        queue: [...currentSession.queue.slice(1), snapshot.id],
        repeats: {
          ...currentSession.repeats,
          [snapshot.id]: (currentSession.repeats[snapshot.id] ?? 0) + 1,
        },
      };
    });
    stageRef.current?.focus();
  }

  function undo() {
    if (!history) return;
    onRestoreCard(history.card);
    setSession(history.session);
    setHistory(null);
    setFlipped(false);
    setTick((value) => value + 1);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        revealOr("hard");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        revealOr("easy");
      } else if (event.key === " " || event.key === "Enter") {
        if (tag === "BUTTON") return;
        event.preventDefault();
        setFlipped((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const struggled = Object.keys(session.repeats).length;

  return (
    <div ref={stageRef} tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] outline-none sm:px-0 sm:pt-5">
      <Confetti show={session.phase === "done"} />
      <div className="grid grid-cols-2 rounded-full border border-border bg-card/80 p-1">
        <button
          type="button"
          aria-pressed={mode === "all"}
          className={`h-10 rounded-full text-sm font-medium transition-colors ${mode === "all" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          onClick={() => changeMode("all")}
        >
          All cards
          <span className="ml-1 tabular-nums opacity-70">{deck.cards.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "mistakes"}
          className={`h-10 rounded-full text-sm font-medium transition-colors ${mode === "mistakes" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          onClick={() => changeMode("mistakes")}
        >
          Mistakes
          <span className="ml-1 tabular-nums opacity-70">{weakCount}</span>
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium" aria-live="polite">
            {session.phase === "done"
              ? "Round complete"
              : session.phase === "empty"
                ? "Nothing queued"
                : repeat
                  ? `Again · card ${position} of ${total}`
                  : `Card ${position} of ${total}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {session.mastered.length} remembered this round
          </p>
        </div>
        {history ? (
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={undo}>
            <Undo2 />
            Undo
          </Button>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 items-stretch sm:mt-5 sm:min-h-[min(68dvh,520px)] sm:items-center">
        <AnimatePresence mode="wait" custom={direction}>
          {session.phase === "study" && current ? (
            <motion.div
              key={`${current.id}-${tick}`}
              custom={direction}
              className="h-[min(48dvh,500px)] w-full sm:h-[min(62dvh,500px)]"
              variants={{
                initial: { opacity: 0, y: 22, scale: 0.985 },
                animate: { opacity: 1, y: 0, scale: 1 },
                exit: (dir: number) => ({
                  opacity: 0,
                  x: dir > 0 ? 90 : -90,
                  rotate: dir > 0 ? 3 : -3,
                }),
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
            >
              <FlashCard card={current} deckName={deck.name} flipped={flipped} onFlip={() => setFlipped((value) => !value)} />
            </motion.div>
          ) : (
            <motion.div
              key={session.phase}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="card-wash w-full rounded-[1.75rem] border border-border px-6 py-12 text-center shadow-[0_30px_70px_-28px_color-mix(in_oklab,var(--foreground)_28%,transparent)]"
            >
              {session.phase === "done" ? (
                <>
                  <p className="font-serif text-5xl text-primary">習</p>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight">This round is finished.</h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                    All {total} cards were marked easy.
                    {struggled > 0
                      ? ` ${struggled} needed another look before they stuck.`
                      : " They stayed with you on the first pass."}
                  </p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" className="rounded-full" onClick={() => changeMode("all")}>
                      Study them again
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold tracking-tight">No cards in the weak list.</h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                    Tap Review again on a card and it will wait here for another pass.
                  </p>
                  <Button type="button" className="mt-6 rounded-full" onClick={() => changeMode("all")}>
                    Study all cards
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-14 rounded-full bg-card/80 text-[15px] sm:h-12 sm:text-sm"
          disabled={session.phase !== "study"}
          onClick={() => revealOr("hard")}
        >
          <RotateCcw />
          <span className="sm:hidden">Again</span>
          <span className="hidden sm:inline">Review again</span>
        </Button>
        <Button
          type="button"
          className="h-14 rounded-full text-[15px] sm:h-12 sm:text-sm"
          disabled={session.phase !== "study"}
          onClick={() => revealOr("easy")}
        >
          <Check />
          Got it
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
        {flipped ? "Tap the card to hide the answer." : current?.kanji.trim() ? "Tap the card to see the reading." : "Tap the card to see the meaning."}
      </p>
      <p className="mt-3 hidden text-center text-xs text-muted-foreground sm:block">
        {flipped ? "← review again · → got it" : "The first tap shows the answer. Space flips the card."}
      </p>
      <p className="sr-only" aria-live="polite">
        {flipped && current ? `${current.reading}. ${current.meaning}` : ""}
      </p>
    </div>
  );
}
