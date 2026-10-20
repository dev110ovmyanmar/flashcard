"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Check, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/confetti";
import { FlashCard } from "@/components/flash-card";
import { Button } from "@/components/ui/button";
import { cardGesture } from "@/lib/card-gesture";
import { isWeak } from "@/lib/srs";
import type { Card, Deck, Grade } from "@/lib/types";

type Mode = "all" | "mistakes";
type Phase = "study" | "done" | "empty";

type Session = {
  queue: string[];
  order: string[];
  trail: string[];
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
    trail: [],
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
  const [tilt, setTilt] = useState(0);
  const [direction, setDirection] = useState(1);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<History | null>(null);
  const lock = useRef(false);
  const skipClick = useRef(false);
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

  function turnCard() {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    setFlipped((value) => !value);
  }

  function nudge(next: Session, dir: number) {
    setDirection(dir);
    setFlipped(false);
    setTilt(0);
    setTick((value) => value + 1);
    setSession(next);
  }

  function goNext() {
    if (!current || session.queue.length < 2 || lock.current) return;
    lock.current = true;
    window.setTimeout(() => {
      lock.current = false;
    }, 320);
    const [first, ...rest] = session.queue;
    nudge({ ...session, queue: [...rest, first], trail: [...session.trail, first] }, 1);
  }

  function goPrevious() {
    const previous = session.trail[session.trail.length - 1];
    if (!current || !previous || lock.current) return;
    lock.current = true;
    window.setTimeout(() => {
      lock.current = false;
    }, 320);
    nudge(
      {
        ...session,
        trail: session.trail.slice(0, -1),
        queue: [previous, ...session.queue.filter((id) => id !== previous)],
      },
      -1,
    );
  }

  function onDrag(_: PointerEvent, info: PanInfo) {
    const across = Math.abs(info.offset.x);
    const along = Math.abs(info.offset.y);
    if (along <= across) {
      setTilt(0);
      return;
    }
    setTilt(Math.max(-18, Math.min(18, -info.offset.y / 12)));
  }

  function onDragEnd(_: PointerEvent, info: PanInfo) {
    setTilt(0);
    if (Math.hypot(info.offset.x, info.offset.y) > 10) {
      skipClick.current = true;
      window.setTimeout(() => {
        skipClick.current = false;
      }, 0);
    }
    const gesture = cardGesture(info.offset, info.velocity);
    if (gesture === "next") goNext();
    else if (gesture === "previous") goPrevious();
    else if (gesture === "flip") setFlipped((value) => !value);
  }

  function flipAgain() {
    if (!current || session.phase !== "study") return;
    if (flipped) {
      const alreadyMissed = (session.repeats[current.id] ?? 0) > 0;
      if (!alreadyMissed) {
        setHistory({ card: current, session });
        onGrade(current.id, "hard");
      }
      setFlipped(false);
      setSession((currentSession) => ({
        ...currentSession,
        repeats: {
          ...currentSession.repeats,
          [current.id]: (currentSession.repeats[current.id] ?? 0) + 1,
        },
      }));
      return;
    }

    const missed = session.queue.filter((id) => (session.repeats[id] ?? 0) > 0);
    const others = session.queue.filter((id) => (session.repeats[id] ?? 0) === 0);
    const alreadyFirst = missed.length > 0 && session.queue.slice(0, missed.length).every((id) => missed.includes(id));
    if (missed.length === 0 || (alreadyFirst && session.queue[0] === current.id)) return;
    nudge({ ...session, queue: [...missed, ...others], trail: [] }, 1);
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
    setTilt(0);
    setTick((value) => value + 1);
    setSession((currentSession) => {
      const trail = currentSession.trail.filter((id) => id !== snapshot.id);
      if (grade === "easy") {
        const queue = currentSession.queue.slice(1);
        const mastered = currentSession.mastered.includes(snapshot.id)
          ? currentSession.mastered
          : [...currentSession.mastered, snapshot.id];
        return {
          ...currentSession,
          queue,
          trail,
          mastered,
          phase: queue.length ? "study" : "done",
        };
      }
      return {
        ...currentSession,
        queue: [...currentSession.queue.slice(1), snapshot.id],
        trail,
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
        commitGrade("hard");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        commitGrade("easy");
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
  const missedCount = session.queue.filter((id) => (session.repeats[id] ?? 0) > 0).length;
  const otherMissed = current ? session.queue.some((id) => id !== current.id && (session.repeats[id] ?? 0) > 0) : false;
  const canFlipAgain = session.phase === "study" && Boolean(current) && (flipped || otherMissed);

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
              className="h-[min(42dvh,480px)] w-full sm:h-[min(62dvh,500px)]"
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
              <motion.div
                className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.18}
                dragMomentum={false}
                dragSnapToOrigin
                onDrag={onDrag}
                onDragEnd={onDragEnd}
              >
                <FlashCard card={current} deckName={deck.name} flipped={flipped} tilt={tilt} onFlip={turnCard} />
              </motion.div>
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

      <div className="mt-4 flex flex-col gap-2 sm:mt-5">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full bg-card/80"
          disabled={!canFlipAgain}
          onClick={flipAgain}
        >
          <RotateCw />
          Flip again
          {missedCount > 0 ? <span className="tabular-nums text-muted-foreground">{missedCount}</span> : null}
        </Button>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-14 rounded-full bg-card/80 text-[15px] sm:h-12 sm:text-sm"
            disabled={session.phase !== "study"}
            onClick={() => commitGrade("hard")}
          >
            <RotateCcw />
            <span className="sm:hidden">Again</span>
            <span className="hidden sm:inline">Review again</span>
          </Button>
          <Button
            type="button"
            className="h-14 rounded-full text-[15px] sm:h-12 sm:text-sm"
            disabled={session.phase !== "study"}
            onClick={() => commitGrade("easy")}
          >
            <Check />
            Got it
          </Button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground sm:hidden">
        {flipped ? "Swipe left for the next card. Flip again stays on this one." : "Swipe up to flip. Swipe left for the next card."}
      </p>
      <p className="mt-3 hidden text-center text-xs text-muted-foreground sm:block">
        Drag up to flip, left for the next card. Space flips. ← review again · → got it
      </p>
      <p className="sr-only" aria-live="polite">
        {flipped && current ? `${current.reading}. ${current.meaning}` : ""}
      </p>
    </div>
  );
}
