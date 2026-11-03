"use client";

import { motion } from "framer-motion";
import { BookOpenText, Layers, ScrollText, Sparkles } from "lucide-react";
import Link from "next/link";

export type AppBottomTab = "decks" | "vocab" | "grammar" | "script";

const EASE_SMOOTH: [number, number, number, number] = [0.16, 1, 0.3, 1];

const TABS: Array<{
  id: AppBottomTab;
  href: string;
  label: string;
  icon: typeof Layers;
}> = [
  { id: "decks", href: "/", label: "Decks", icon: Layers },
  { id: "vocab", href: "/jlpt-analyzer", label: "Vocab", icon: Sparkles },
  { id: "grammar", href: "/grammar-analyzer", label: "Grammar", icon: BookOpenText },
  { id: "script", href: "/script-analyzer", label: "Script", icon: ScrollText },
];

/**
 * Sticky mobile bottom nav — pill glides with a soft tween between tabs.
 */
export function AppBottomNav({ active }: { active: AppBottomTab }) {
  return (
    <nav
      aria-label="App"
      className={[
        "fixed inset-x-0 bottom-0 z-40 sm:hidden",
        "border-t border-border/60 bg-background/90 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.18)] dark:shadow-[0_-8px_28px_-14px_rgba(0,0,0,0.55)]",
        "transform-gpu",
      ].join(" ")}
      style={{ transform: "translate3d(0,0,0)" }}
    >
      <div className="mx-auto flex h-[3.75rem] max-w-lg items-stretch gap-0.5 px-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
                "text-[10px] font-medium leading-none tracking-tight",
                "transition-colors duration-300 ease-out",
                "active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                "[&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out",
                isActive
                  ? "text-primary [&_svg]:scale-105"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {isActive ? (
                <motion.span
                  layoutId="app-bottom-nav-pill"
                  className="absolute inset-1 -z-10 rounded-xl bg-primary/10"
                  transition={{ duration: 0.36, ease: EASE_SMOOTH }}
                  style={{ transform: "translate3d(0,0,0)" }}
                />
              ) : null}
              <Icon aria-hidden />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** @deprecated Prefer app-chrome--with-nav padding in globals.css */
export const APP_BOTTOM_NAV_PAD =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-[max(2rem,env(safe-area-inset-bottom))]";
