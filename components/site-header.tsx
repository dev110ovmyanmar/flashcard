"use client";

import { ArrowLeft, Download, Upload } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

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

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {showBackup ? (
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
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
