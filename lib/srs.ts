import type { Card, Grade } from "@/lib/types";

const DAY = 86_400_000;

export function isWeak(card: Card): boolean {
  return card.lastGrade === "hard" || (card.lapses > 0 && card.repetitions === 0);
}

export function applyGrade(card: Card, grade: Grade, now = Date.now()): Card {
  if (grade === "hard") {
    return {
      ...card,
      ease: roundEase(Math.max(1.3, card.ease - 0.2)),
      intervalDays: 0,
      repetitions: 0,
      dueAt: now,
      lapses: card.lapses + 1,
      lastGrade: "hard",
      reviews: card.reviews + 1,
    };
  }

  const repetitions = card.repetitions + 1;
  let intervalDays = card.intervalDays;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 3;
  else intervalDays = Math.max(1, Math.round(intervalDays * card.ease));

  return {
    ...card,
    ease: roundEase(Math.min(2.8, card.ease + 0.08)),
    intervalDays,
    repetitions,
    dueAt: now + intervalDays * DAY,
    lastGrade: "easy",
    reviews: card.reviews + 1,
  };
}

function roundEase(value: number): number {
  return Math.round(value * 100) / 100;
}
