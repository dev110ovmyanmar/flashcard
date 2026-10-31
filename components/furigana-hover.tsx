"use client";

import { cn } from "cn";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  hasKanji,
  resolveFuriganaSegments,
  type FuriganaSegment,
} from "@/lib/furigana";

export type { FuriganaSegment };
/** @deprecated Use FuriganaSegment */
export type FuriganaToken = FuriganaSegment;

type FuriganaHoverProps = {
  /** Japanese surface text (kanji / kana / mixed). */
  text: string;
  /** Reading for the whole `text` when tokens/map/markup are absent. */
  reading?: string | null;
  /** Prefers per-token annotations when provided (JLPT stems). */
  tokens?: Array<{ surface: string; reading?: string | null }> | null;
  /** Headword → reading map applied longest-first. */
  readings?: Record<string, string> | null;
  className?: string;
  /** Wrapper language (use `my` for Burmese prose with embedded Japanese). */
  lang?: string;
  /** Always show readings inline (e.g. flashcard back). */
  alwaysShow?: boolean;
  /** Keyboard-focusable hover targets. Off inside other interactive controls. */
  focusable?: boolean;
};

type TooltipState = {
  reading: string;
  top: number;
  left: number;
};

function FuriganaTooltip({ state, labelledBy }: { state: TooltipState | null; labelledBy: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !state) return null;

  const style: CSSProperties = {
    position: "fixed",
    top: state.top,
    left: state.left,
    transform: "translate(-50%, calc(-100% - 0.35rem))",
  };

  return createPortal(
    <span
      role="tooltip"
      id={labelledBy}
      lang="ja"
      style={style}
      className={cn(
        "pointer-events-none z-[200] max-w-[min(12rem,70vw)] rounded-md border border-border/70",
        "bg-popover/95 px-2 py-1 font-sans text-xs leading-none tracking-[0.04em] text-popover-foreground shadow-md",
        "backdrop-blur-sm transition-opacity duration-150",
        "dark:border-white/12 dark:bg-popover/90",
      )}
    >
      {state.reading}
    </span>,
    document.body,
  );
}

/** Brief pause before pairing furigana above the kanji (feels intentional, avoids flicker). */
const HOVER_PAIR_DELAY_MS = 450;

function HoverableKanji({
  surface,
  reading,
  alwaysShow,
  focusable,
  className,
}: {
  surface: string;
  reading: string;
  alwaysShow: boolean;
  focusable: boolean;
  className?: string;
}) {
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const clearDelay = useCallback(() => {
    if (delayRef.current !== null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setTooltip({
      reading,
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, [reading]);

  const showSoon = useCallback(
    (immediate = false) => {
      clearDelay();
      if (immediate) {
        updatePosition();
        return;
      }
      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        updatePosition();
      }, HOVER_PAIR_DELAY_MS);
    },
    [clearDelay, updatePosition],
  );

  const hide = useCallback(() => {
    clearDelay();
    setTooltip(null);
  }, [clearDelay]);

  useEffect(() => () => clearDelay(), [clearDelay]);

  useLayoutEffect(() => {
    if (!tooltip) return;
    const onScrollOrResize = () => updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) hide();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [tooltip, updatePosition, hide]);

  if (alwaysShow) {
    return (
      <ruby
        lang="ja"
        className={cn("furigana-ruby furigana-ruby-open inline align-baseline", className)}
      >
        {surface}
        <rp>(</rp>
        <rt className="furigana-rt select-none font-sans text-[0.55em] leading-none text-muted-foreground">
          {reading}
        </rt>
        <rp>)</rp>
      </ruby>
    );
  }

  const open = Boolean(tooltip);

  return (
    <>
      <span
        ref={ref}
        lang="ja"
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => showSoon(false)}
        onMouseLeave={hide}
        onFocus={() => showSoon(true)}
        onBlur={hide}
        onTouchStart={(event) => {
          event.stopPropagation();
          showSoon(true);
        }}
        className={cn(
          "furigana-hover-target relative inline cursor-help rounded-[2px] align-baseline transition-colors duration-150",
          "decoration-dotted underline-offset-[0.22em]",
          "hover:bg-primary/[0.06] focus-visible:bg-primary/[0.08] focus-visible:outline-none",
          "dark:hover:bg-primary/10",
          open && "bg-primary/[0.08] underline decoration-primary/40",
          className,
        )}
      >
        {surface}
      </span>
      <FuriganaTooltip state={tooltip} labelledBy={tipId} />
    </>
  );
}

function renderSegments(
  segments: FuriganaSegment[],
  options: { alwaysShow: boolean; focusable: boolean; className?: string; lang: string },
) {
  return segments.map((segment, index) => {
    const surface = segment.surface;
    if (!surface) return null;
    const reading = segment.reading?.trim() ?? "";
    if (reading && hasKanji(surface)) {
      return (
        <HoverableKanji
          key={`fk-${index}-${surface}-${reading}`}
          surface={surface}
          reading={reading}
          alwaysShow={options.alwaysShow}
          focusable={options.focusable}
          className={options.className}
        />
      );
    }
    return (
      <span
        key={`fp-${index}-${surface}`}
        lang={options.lang}
        className={cn("inline whitespace-pre-wrap align-baseline", options.className)}
      >
        {surface}
      </span>
    );
  });
}

/**
 * Reusable wrapper: renders Japanese text and shows furigana on hover
 * for any kanji span that has a reading (tokens, map, markup, or `reading`).
 */
export function FuriganaHover({
  text,
  reading,
  tokens,
  readings,
  className,
  lang = "ja",
  alwaysShow = false,
  focusable = true,
}: FuriganaHoverProps) {
  const segments = resolveFuriganaSegments({ text, reading, tokens, readings });
  const isSentence = segments.length > 1 || /[。．！？\n]|_____/.test(text);

  return (
    <span
      lang={lang}
      className={cn(
        isSentence ? "furigana-sentence" : "inline align-baseline",
        className,
      )}
    >
      {renderSegments(segments, { alwaysShow, focusable, lang })}
    </span>
  );
}

/** @deprecated Prefer FuriganaHover — kept for existing call sites. */
export function FuriganaText({
  text,
  reading,
  className,
  alwaysShow = false,
  focusable = true,
}: {
  text: string;
  reading?: string | null;
  className?: string;
  rubyClassName?: string;
  alwaysShow?: boolean;
  focusable?: boolean;
}) {
  return (
    <FuriganaHover
      text={text}
      reading={reading}
      className={className}
      alwaysShow={alwaysShow}
      focusable={focusable}
    />
  );
}

/** @deprecated Prefer FuriganaHover with `tokens` — kept for existing call sites. */
export function FuriganaSentence({
  text,
  tokens,
  targetWord,
  targetReading,
  className,
}: {
  text: string;
  tokens?: Array<{ surface: string; reading?: string | null }> | null;
  targetWord?: string | null;
  targetReading?: string | null;
  className?: string;
}) {
  const readings =
    targetWord?.trim() && targetReading?.trim()
      ? { [targetWord.trim()]: targetReading.trim() }
      : null;

  return (
    <FuriganaHover
      text={text}
      tokens={tokens}
      readings={readings}
      reading={targetReading}
      className={className}
    />
  );
}
