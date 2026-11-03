"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppTopBar } from "@/components/app-top-bar";

/** Analyzer pages — icon-only back to Decks (no “Decks” label). */
export function AnalyzerPageHeader({ title }: { title: string }) {
  return (
    <AppTopBar
      title={title}
      leading={
        <Link
          href="/"
          aria-label="Back to decks"
          title="Back to decks"
          className={[
            "hidden size-9 shrink-0 items-center justify-center rounded-full sm:inline-flex",
            "border border-border/70 bg-card/80 text-foreground shadow-none",
            "transition-all duration-200",
            "hover:border-border hover:bg-muted/70",
            "active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
            "[&_svg]:size-4",
          ].join(" ")}
        >
          <ArrowLeft aria-hidden />
        </Link>
      }
    />
  );
}
