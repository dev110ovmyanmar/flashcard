"use client";

import { ArrowLeft, Download, Upload } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { AppTopBar } from "@/components/app-top-bar";

const headerIconBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/80 text-muted-foreground shadow-none transition-all duration-200 hover:border-border hover:bg-muted/70 hover:text-foreground active:scale-[0.98] [&_svg:not([class*='size-'])]:size-3.5";

export function SiteHeader({
  title,
  onBack,
  onExportBackup,
  onImportBackupFile,
  actions,
}: {
  title?: string;
  onBack?: () => void;
  onExportBackup?: () => void;
  onImportBackupFile?: (file: File) => void;
  actions?: ReactNode;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const showBackup = Boolean(onExportBackup && onImportBackupFile);

  const backupActions = showBackup ? (
    <>
      <button
        type="button"
        className={headerIconBtn}
        aria-label="Export JSON backup"
        title="Export JSON"
        onClick={onExportBackup}
      >
        <Download aria-hidden />
      </button>
      <button
        type="button"
        className={headerIconBtn}
        aria-label="Import JSON backup"
        title="Import JSON"
        onClick={() => importRef.current?.click()}
      >
        <Upload aria-hidden />
      </button>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportBackupFile?.(file);
          event.target.value = "";
        }}
      />
    </>
  ) : null;

  // Study session — icon-only back (no “Decks” label).
  if (onBack) {
    return (
      <AppTopBar
        title={title?.trim() || "Study"}
        leading={
          <button
            type="button"
            className={[
              headerIconBtn,
              "inline-flex size-9 rounded-full text-foreground",
            ].join(" ")}
            aria-label="Back to decks"
            title="Back to decks"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
        }
        actions={actions}
      />
    );
  }

  // Home desk — same AppTopBar as Vocabulary / Grammar / Script.
  return (
    <AppTopBar
      title="Sumi"
      subtitle="Japanese, from the page"
      leading={
        <span className="grid size-8 place-items-center rounded-full border border-border bg-card font-serif text-base leading-none sm:size-9 sm:text-lg">
          墨
        </span>
      }
      actions={
        <>
          {actions}
          {backupActions}
        </>
      }
    />
  );
}
