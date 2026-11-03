const MAX_BYTES = 12 * 1024 * 1024;

/** Default desk OCR prep — balanced sharpness vs upload size. */
export const OCR_IMAGE_PREP = {
  maxEdge: 1100,
  quality: 0.62,
  minQuality: 0.45,
  maxBase64Chars: 520_000,
} as const;

/** Vision analyzers (JLPT / grammar / script photos) — leaner payloads. */
export const JLPT_IMAGE_PREP = {
  maxEdge: 720,
  quality: 0.5,
  minQuality: 0.36,
  /** Smaller uploads → faster Gemini vision turnaround. */
  maxBase64Chars: 180_000,
} as const;

export type PrepareImageOptions = {
  maxEdge?: number;
  quality?: number;
  minQuality?: number;
  maxBase64Chars?: number;
};

export type PreparedImage = {
  base64: string;
  previewUrl: string;
  width: number;
  height: number;
  bytesApprox: number;
};

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export async function fileToJpegBase64(
  file: File,
  options?: PrepareImageOptions,
): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That photo is over 12 MB. Try a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo couldn't be opened. Use JPEG, PNG, or WebP.");
  }

  const maxEdge = options?.maxEdge ?? OCR_IMAGE_PREP.maxEdge;
  const startQuality = options?.quality ?? OCR_IMAGE_PREP.quality;
  const minQuality = options?.minQuality ?? OCR_IMAGE_PREP.minQuality;
  const maxBase64Chars = options?.maxBase64Chars ?? OCR_IMAGE_PREP.maxBase64Chars;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close?.();
    throw new Error("Couldn't prepare the photo.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "medium";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = startQuality;
  let previewUrl = canvasToJpegDataUrl(canvas, quality);
  let base64 = previewUrl.split(",")[1] ?? "";

  while (base64.length > maxBase64Chars && quality > minQuality + 0.01) {
    quality = Math.max(minQuality, quality - 0.07);
    previewUrl = canvasToJpegDataUrl(canvas, quality);
    base64 = previewUrl.split(",")[1] ?? "";
  }

  // Last resort: shrink canvas edge if still oversized at min quality.
  if (base64.length > maxBase64Chars) {
    const shrink = Math.sqrt(maxBase64Chars / base64.length);
    const nextW = Math.max(480, Math.round(width * Math.min(1, shrink)));
    const nextH = Math.max(480, Math.round((height * nextW) / width));
    const shrinkCanvas = document.createElement("canvas");
    shrinkCanvas.width = nextW;
    shrinkCanvas.height = nextH;
    const shrinkContext = shrinkCanvas.getContext("2d", { alpha: false });
    if (shrinkContext) {
      shrinkContext.drawImage(canvas, 0, 0, nextW, nextH);
      previewUrl = canvasToJpegDataUrl(shrinkCanvas, minQuality);
      base64 = previewUrl.split(",")[1] ?? "";
      return {
        base64,
        previewUrl,
        width: nextW,
        height: nextH,
        bytesApprox: Math.round((base64.length * 3) / 4),
      };
    }
  }

  if (!base64) throw new Error("Couldn't prepare the photo.");
  return {
    base64,
    previewUrl,
    width,
    height,
    bytesApprox: Math.round((base64.length * 3) / 4),
  };
}

/** Compress/resize a vision-analyzer photo before API upload. */
export function fileToJpegBase64ForJlpt(file: File) {
  return fileToJpegBase64(file, JLPT_IMAGE_PREP);
}
