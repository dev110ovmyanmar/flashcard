"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#c4512c", "#2f6f5e", "#e2b657", "#f7f1e6", "#243028", "#e38b63"];

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  size: number;
  height: number;
  color: string;
  radius: number;
  drift: number;
};

function makePieces(): Piece[] {
  return Array.from({ length: 42 }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    duration: 1.6 + Math.random() * 1.3,
    rotate: -220 + Math.random() * 440,
    size: 6 + Math.random() * 7,
    height: 8 + Math.random() * 10,
    color: COLORS[id % COLORS.length],
    radius: Math.random() > 0.55 ? 999 : 2,
    drift: -80 + Math.random() * 160,
  }));
}

export function Confetti({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => (show ? makePieces() : []), [show]);
  if (!show || reduce) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ y: "-12vh", x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "108vh", x: piece.drift, rotate: piece.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${piece.left}%`,
            top: 0,
            width: piece.size,
            height: piece.height,
            background: piece.color,
            borderRadius: piece.radius,
          }}
        />
      ))}
    </div>
  );
}
