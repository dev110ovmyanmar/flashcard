"use client";

import { cn } from "cn";

const KANJI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function hasKanji(text: string): boolean {
  return KANJI_RE.test(text);
}

type FuriganaTextProps = {
  text: string;
  reading?: string | null;
  className?: string;
  rubyClassName?: string;
  /** Always show furigana (e.g. flashcard back). Default: reveal on hover/focus. */
  alwaysShow?: boolean;
  /** Make ruby keyboard-focusable. Off when nested inside another interactive control. */
  focusable?: boolean;
};

/**
 * Kanji (or mixed) text with hover/focus furigana via native ruby.
 * Screen readers still get the reading through `<rp>` fallbacks.
 */
export function FuriganaText({
  text,
  reading,
  className,
  rubyClassName,
  alwaysShow = false,
  focusable = true,
}: FuriganaTextProps) {
  const surface = text.trim() || "—";
  const yomi = reading?.trim() ?? "";

  if (!yomi || !hasKanji(surface)) {
    return (
      <span lang="ja" className={className}>
        {surface}
      </span>
    );
  }

  return (
    <ruby
      lang="ja"
      className={cn(
        "furigana-ruby inline-flex flex-col-reverse items-center align-baseline",
        alwaysShow ? "furigana-ruby-open" : "furigana-ruby-hover group/furi",
        rubyClassName,
        className,
      )}
      tabIndex={alwaysShow || !focusable ? undefined : 0}
      title={alwaysShow ? undefined : yomi}
    >
      <span className="leading-none">{surface}</span>
      <rp>(</rp>
      <rt
        className={cn(
          "mb-0.5 select-none font-sans text-[0.55em] leading-none tracking-[0.04em] text-muted-foreground",
          alwaysShow
            ? "opacity-100"
            : "opacity-0 transition-opacity duration-150 group-hover/furi:opacity-100 group-focus-visible/furi:opacity-100",
        )}
      >
        {yomi}
      </rt>
      <rp>)</rp>
    </ruby>
  );
}

export type FuriganaToken = {
  surface: string;
  reading?: string | null;
};

type FuriganaSentenceProps = {
  text: string;
  tokens?: FuriganaToken[] | null;
  /** When tokens are missing, highlight this word with reading on hover. */
  targetWord?: string | null;
  targetReading?: string | null;
  className?: string;
};

/** Renders a JLPT stem with per-token hover furigana when tokens exist. */
export function FuriganaSentence({
  text,
  tokens,
  targetWord,
  targetReading,
  className,
}: FuriganaSentenceProps) {
  const trimmed = text.trim();
  if (!trimmed) {
    return (
      <span lang="ja" className={className}>
        —
      </span>
    );
  }

  if (tokens && tokens.length > 0) {
    return (
      <span lang="ja" className={className}>
        {tokens.map((token, index) => {
          const surface = token.surface;
          if (!surface) return null;
          const reading = token.reading?.trim() ?? "";
          if (reading && hasKanji(surface)) {
            return <FuriganaText key={`ft-${index}-${surface}`} text={surface} reading={reading} />;
          }
          return <span key={`ft-${index}-${surface}`}>{surface}</span>;
        })}
      </span>
    );
  }

  const target = targetWord?.trim() ?? "";
  const yomi = targetReading?.trim() ?? "";
  if (target && yomi && trimmed.includes(target)) {
    const parts = trimmed.split(target);
    return (
      <span lang="ja" className={className}>
        {parts.map((part, index) => (
          <span key={`sp-${index}`}>
            {part}
            {index < parts.length - 1 ? <FuriganaText text={target} reading={yomi} /> : null}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span lang="ja" className={className}>
      {trimmed}
    </span>
  );
}
