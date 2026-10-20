export type CardGesture = "flip" | "next" | "previous";

const DISTANCE = 64;
const FLICK = 700;

export function cardGesture(
  offset: { x: number; y: number },
  velocity: { x: number; y: number },
): CardGesture | null {
  const across = Math.abs(offset.x);
  const along = Math.abs(offset.y);
  if (across > along && (across > DISTANCE || Math.abs(velocity.x) > FLICK)) {
    return offset.x < 0 ? "next" : "previous";
  }
  if (along > across && (along > DISTANCE || Math.abs(velocity.y) > FLICK)) return "flip";
  return null;
}
