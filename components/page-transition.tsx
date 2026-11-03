"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const EASE_SMOOTH: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Survives `template.tsx` remounts — first paint never animates. */
let hasHydratedOnce = false;

function useIsMobileUi() {
  const [mobile, setMobile] = useState(true); // default true = no flash on first mobile paint

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

/**
 * Desktop: soft opacity/scale enter.
 * Mobile: instant swap — no fade (avoids blank-frame flash between tabs).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobileUi();

  useEffect(() => {
    hasHydratedOnce = true;
  }, []);

  // Mobile / reduced motion / first paint → no enter animation (no flash).
  if (isMobile || reduceMotion || !hasHydratedOnce) {
    return (
      <div className="page-shell" style={{ transform: "translate3d(0,0,0)" }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={pathname}
      className="page-shell"
      initial={{ opacity: 0, scale: 0.992 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.28,
        ease: EASE_SMOOTH,
        opacity: { duration: 0.24, ease: EASE_SMOOTH },
        scale: { duration: 0.28, ease: EASE_SMOOTH },
      }}
      style={{
        transformOrigin: "50% 0%",
        transform: "translate3d(0,0,0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {children}
    </motion.div>
  );
}
