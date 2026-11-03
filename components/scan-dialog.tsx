"use client";

import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGeminiStatus } from "@/hooks/use-gemini-status";
import { requestOcr } from "@/lib/client-ocr";
import { fileToJpegBase64 } from "@/lib/prepare-image";
import type { OcrSuccess } from "@/lib/types";

export type ScanDialogHandle = {
  read: (file: File) => void;
  reset: () => void;
};

const actionBtnBase =
  "h-11 w-full gap-2 overflow-hidden rounded-xl px-4 text-sm font-medium shadow-none transition-colors duration-200 [&_svg:not([class*='size-'])]:size-4";
const actionPrimary =
  `${actionBtnBase} border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 dark:border-primary/40 dark:hover:bg-primary/85`;
const actionSecondary =
  `${actionBtnBase} border border-border/80 bg-background text-foreground hover:bg-muted/70 dark:border-white/12 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]`;

export function ScanDialog({
  ref,
  open,
  onOpenChange,
  onResult,
}: {
  ref?: React.Ref<ScanDialogHandle>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (result: OcrSuccess) => void;
}) {
  const geminiConfigured = useGeminiStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onResultRef = useRef(onResult);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setReading(true);
    try {
      const prepared = await fileToJpegBase64(file);
      if (controller.signal.aborted) return;
      setPreview(prepared.previewUrl);
      const result = await requestOcr(prepared.base64, "image/jpeg", controller.signal);
      if (controller.signal.aborted) return;
      onResultRef.current(result);
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setError(caught instanceof Error ? caught.message : "The page couldn't be read.");
      setReading(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setPreview(null);
    setReading(false);
    setError(null);
    setDragging(false);
  }

  useImperativeHandle(ref, () => ({
    read(file: File) {
      onResultRef.current = onResult;
      void readFile(file);
    },
    reset,
  }));

  function takeFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file || reading) return;
    onResultRef.current = onResult;
    void readFile(file);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-4 max-sm:p-5 max-sm:pt-12 sm:max-w-md sm:gap-5 sm:p-6 sm:pt-12">
        <DialogHeader className="sr-only">
          <DialogTitle>Scan</DialogTitle>
          <DialogDescription>Upload a textbook page photo.</DialogDescription>
        </DialogHeader>

        {geminiConfigured === null ? (
          <p
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Checking AI setup…
          </p>
        ) : geminiConfigured === false ? (
          <p className="rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-sm leading-5">
            No API key set — a practice page will open instead.
          </p>
        ) : null}

        <div
          className={`rounded-2xl border border-dashed px-5 py-9 text-center transition-colors duration-200 ${
            dragging
              ? "border-primary/50 bg-primary/[0.08]"
              : "border-border/70 bg-muted/20 hover:border-primary/30 hover:bg-muted/30 dark:border-white/12 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            takeFiles(event.dataTransfer.files);
          }}
        >
          {preview ? (
            // Local preview of a photo the user just chose.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Selected textbook page"
              className="mx-auto max-h-48 rounded-xl object-contain"
            />
          ) : (
            <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border/60 bg-card text-primary dark:border-white/10 dark:bg-white/[0.04]">
              <ImagePlus className="size-5" />
            </div>
          )}
          <p className="mt-3.5 text-sm font-medium tracking-tight">
            {reading ? "Reading…" : "Drop a photo here"}
          </p>
          {reading ? <Loader2 className="mx-auto mt-3 size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className={actionSecondary}
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
            Choose photo
          </Button>
          <Button
            type="button"
            className={actionPrimary}
            disabled={reading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera />
            Use camera
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
