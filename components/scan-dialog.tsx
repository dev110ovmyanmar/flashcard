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
import { requestOcr } from "@/lib/client-ocr";
import { fileToJpegBase64 } from "@/lib/prepare-image";
import type { OcrSuccess } from "@/lib/types";

export type ScanDialogHandle = {
  read: (file: File) => void;
  reset: () => void;
};

export function ScanDialog({
  ref,
  open,
  geminiConfigured,
  onOpenChange,
  onResult,
}: {
  ref?: React.Ref<ScanDialogHandle>;
  open: boolean;
  geminiConfigured: boolean | null;
  onOpenChange: (open: boolean) => void;
  onResult: (result: OcrSuccess) => void;
}) {
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
    if (!file) return;
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Scan a textbook page</DialogTitle>
          <DialogDescription>
            Use a photo where the kanji, the reading, and the Myanmar meaning sit in rows. You can correct every line before any card is saved.
          </DialogDescription>
        </DialogHeader>

        {geminiConfigured === false ? (
          <p className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-6">
            No Gemini API key is set on this server. The next step opens a practice page in the same shape as a scanned list.
          </p>
        ) : null}

        <div
          className={`rounded-3xl border border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}
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
            <img src={preview} alt="Selected textbook page" className="mx-auto max-h-56 rounded-2xl object-contain" />
          ) : (
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-card text-primary">
              <ImagePlus />
            </div>
          )}
          <p className="mt-3 text-sm font-medium">{reading ? "Reading the page…" : "Drop a photo here"}</p>
          <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP</p>
          {reading ? <Loader2 className="mx-auto mt-3 size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={reading} onClick={() => fileRef.current?.click()}>
            <ImagePlus />
            Choose photo
          </Button>
          <Button type="button" className="rounded-full" disabled={reading} onClick={() => cameraRef.current?.click()}>
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
