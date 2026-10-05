"use client";

import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader({
  title,
  onBack,
}: {
  title?: string;
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        {onBack ? (
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onBack}>
              <ArrowLeft />
              Decks
            </Button>
            {title ? <p className="truncate text-sm font-medium">{title}</p> : null}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full border border-border bg-card font-serif text-lg leading-none">
              墨
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight">Sumi</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">Japanese, from the page</p>
            </div>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
