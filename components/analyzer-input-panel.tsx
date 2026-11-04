"use client";

import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import type { DragEvent } from "react";
import {
  AnalyzerInputModeSwitcher,
  type AnalyzerInputMode,
} from "@/components/analyzer-input-mode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UI } from "@/src/constants/uiCopy";

const surface =
  "rounded-xl border border-border/60 bg-card/90 shadow-xs ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-border/50 dark:ring-white/[0.03]";

const btnAnalyze =
  [
    "inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5",
    "border border-primary/30 bg-primary text-sm font-semibold tracking-tight text-primary-foreground",
    "shadow-[0_1px_2px_color-mix(in_oklab,var(--foreground)_12%,transparent),0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)]",
    "transition-all duration-200",
    "hover:bg-primary/92 hover:shadow-[0_2px_4px_color-mix(in_oklab,var(--foreground)_10%,transparent),0_10px_22px_-10px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
    "active:translate-y-px active:scale-[0.985] active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
    "sm:w-auto sm:min-w-[8.5rem]",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" ");

const btnGhost =
  "h-9 gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/70 hover:text-foreground active:scale-[0.98] dark:hover:bg-white/[0.06] [&_svg:not([class*='size-'])]:size-3.5";

const btnQuiet =
  "h-9 gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3.5 text-xs font-medium text-foreground shadow-none transition-all duration-200 hover:bg-muted/60 active:scale-[0.98] [&_svg:not([class*='size-'])]:size-3.5";

export type AnalyzerPreparedImage = {
  base64: string;
  previewUrl: string;
};

type AnalyzerInputPanelProps = {
  mode: AnalyzerInputMode;
  onModeChange: (mode: AnalyzerInputMode) => void;
  analyzing: boolean;
  canAnalyze: boolean;
  geminiReady: boolean;
  dragging: boolean;
  prepared: AnalyzerPreparedImage | null;
  textInput: string;
  maxTextChars: number;
  imageHint: string;
  imageAlt: string;
  textTitle: string;
  textHint: string;
  textPlaceholder: string;
  textareaId: string;
  onTextChange: (value: string) => void;
  onPickFile: () => void;
  onPickCamera: () => void;
  onClear: () => void;
  onAnalyze: () => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
};

export function AnalyzerInputPanel({
  mode,
  onModeChange,
  analyzing,
  canAnalyze,
  geminiReady,
  dragging,
  prepared,
  textInput,
  maxTextChars,
  imageHint,
  imageAlt,
  textTitle,
  textHint,
  textPlaceholder,
  textareaId,
  onTextChange,
  onPickFile,
  onPickCamera,
  onClear,
  onAnalyze,
  onDragOver,
  onDragLeave,
  onDrop,
}: AnalyzerInputPanelProps) {
  const hasInput = canAnalyze;

  return (
    <section
      className={[
        surface,
        "overflow-hidden transition-all duration-200",
        dragging && mode === "image" ? "border-primary/40 bg-primary/[0.06] shadow-sm" : "",
      ].join(" ")}
    >
      <div className="border-b border-border/50 px-3 py-3 sm:px-4">
        <AnalyzerInputModeSwitcher mode={mode} disabled={analyzing} onChange={onModeChange} />
      </div>

      {mode === "image" ? (
        <div
          className={[
            "px-4 py-5 transition-colors duration-200 sm:px-5 sm:py-6",
            prepared ? "bg-muted/20" : "",
          ].join(" ")}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {prepared ? (
            <div className="relative">
              {/* Local preview of a compressed photo the user just chose. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prepared.previewUrl}
                alt={imageAlt}
                className="mx-auto max-h-44 w-full rounded-lg border border-border/50 object-contain sm:max-h-52"
              />
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  className={[btnGhost, "bg-background/90 shadow-xs backdrop-blur-sm"].join(" ")}
                  disabled={analyzing}
                  onClick={onClear}
                >
                  <X />
                  {UI.input.clear}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center sm:py-10">
              <div className="grid size-11 place-items-center rounded-xl border border-border/60 bg-background text-primary">
                <ImagePlus className="size-5" />
              </div>
              <p className="mt-3 text-sm font-medium tracking-tight text-foreground">
                {UI.input.dropImage}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{imageHint}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={btnQuiet}
                  disabled={analyzing}
                  onClick={onPickFile}
                >
                  <ImagePlus />
                  {UI.input.upload}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={btnQuiet}
                  disabled={analyzing}
                  onClick={onPickCamera}
                >
                  <Camera />
                  {UI.input.camera}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor={textareaId} className="block text-sm font-medium tracking-tight text-foreground">
                {textTitle}
              </label>
              {textHint ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{textHint}</p>
              ) : null}
            </div>
            {hasInput ? (
              <Button
                type="button"
                variant="ghost"
                className={btnGhost}
                disabled={analyzing}
                onClick={onClear}
              >
                <X />
                {UI.input.clear}
              </Button>
            ) : null}
          </div>

          <Textarea
            id={textareaId}
            value={textInput}
            disabled={analyzing}
            placeholder={textPlaceholder}
            className="min-h-48 w-full resize-y rounded-xl border-border/60 bg-background/80 px-4 py-3.5 text-left text-sm leading-7 shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-ring/40 sm:min-h-56"
            onChange={(event) => onTextChange(event.target.value.slice(0, maxTextChars))}
          />
          <p className="text-right text-[11px] leading-5 text-muted-foreground tabular-nums">
            {textInput.length.toLocaleString()} / {maxTextChars.toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex justify-end border-t border-border/50 px-3 py-3.5 sm:px-4">
        <button
          type="button"
          className={btnAnalyze}
          disabled={!canAnalyze || analyzing || geminiReady !== true}
          onClick={onAnalyze}
        >
          {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          <span>{analyzing ? UI.input.analyzing : UI.input.analyze}</span>
        </button>
      </div>
    </section>
  );
}
