"use client";

import { Loader2 } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchOcrStatus } from "@/lib/client-ocr";

/** `null` = still checking; never treat as missing. */
export type GeminiConfigured = boolean | null;

const GeminiStatusContext = createContext<GeminiConfigured>(null);

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function GeminiStatusProvider({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState<GeminiConfigured>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchOcrStatus(controller.signal)
      .then((ok) => {
        if (active) setConfigured(ok);
      })
      .catch((error: unknown) => {
        // Aborts from Strict Mode remount / route change must not flash "missing key".
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        setConfigured(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return (
    <GeminiStatusContext.Provider value={configured}>{children}</GeminiStatusContext.Provider>
  );
}

export function useGeminiStatus(): GeminiConfigured {
  return useContext(GeminiStatusContext);
}

/** Compact status strip — spinner while checking, warning only when confirmed missing. */
export function GeminiKeyNotice({
  className = "",
  missingCopy,
}: {
  className?: string;
  missingCopy?: ReactNode;
}) {
  const configured = useGeminiStatus();
  const [showChecking, setShowChecking] = useState(false);

  // Avoid a one-frame spinner flash when the status resolves quickly.
  useEffect(() => {
    if (configured !== null) {
      setShowChecking(false);
      return;
    }
    const timer = window.setTimeout(() => setShowChecking(true), 180);
    return () => window.clearTimeout(timer);
  }, [configured]);

  if (configured === true) return null;

  if (configured === null) {
    if (!showChecking) return null;
    return (
      <div
        className={[
          "flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground",
          className,
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span>Checking AI setup…</span>
      </div>
    );
  }

  return (
    <p
      className={[
        "rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6",
        className,
      ].join(" ")}
      role="alert"
    >
      {missingCopy ?? (
        <>
          No Gemini API key is set. Add <code className="text-xs">GEMINI_API_KEY</code> to{" "}
          <code className="text-xs">.env.local</code>, then restart the dev server.
        </>
      )}
    </p>
  );
}
