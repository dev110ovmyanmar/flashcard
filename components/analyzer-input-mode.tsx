"use client";

import { ImageIcon, Type } from "lucide-react";

export type AnalyzerInputMode = "image" | "text";

const switcherShell =
  "grid w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/30 p-1";

const modeBtn =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 [&_svg:not([class*='size-'])]:size-3.5";

type AnalyzerInputModeSwitcherProps = {
  mode: AnalyzerInputMode;
  disabled?: boolean;
  onChange: (mode: AnalyzerInputMode) => void;
};

export function AnalyzerInputModeSwitcher({
  mode,
  disabled = false,
  onChange,
}: AnalyzerInputModeSwitcherProps) {
  return (
    <div className={switcherShell} role="tablist" aria-label="Input mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "image"}
        disabled={disabled}
        className={[
          modeBtn,
          mode === "image"
            ? "bg-card text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
          disabled ? "pointer-events-none opacity-40" : "",
        ].join(" ")}
        onClick={() => onChange("image")}
      >
        <ImageIcon aria-hidden />
        <span>Image</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "text"}
        disabled={disabled}
        className={[
          modeBtn,
          mode === "text"
            ? "bg-card text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
          disabled ? "pointer-events-none opacity-40" : "",
        ].join(" ")}
        onClick={() => onChange("text")}
      >
        <Type aria-hidden />
        <span>Text</span>
      </button>
    </div>
  );
}
