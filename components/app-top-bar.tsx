"use client";

import type { ReactNode } from "react";
import { ClearCacheButton } from "@/components/clear-cache-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shared sticky app bar — same shell on Decks + analyzer pages.
 */
export function AppTopBar({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Optional mark / avatar to the left of the title (home brand). */
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl transform-gpu"
      style={{ transform: "translate3d(0,0,0)" }}
    >
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {leading}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</p>
            {subtitle ? (
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <ClearCacheButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
