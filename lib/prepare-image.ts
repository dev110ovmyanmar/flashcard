const MAX_EDGE = 1280;
const MAX_BYTES = 12 * 1024 * 1024;

/** JLPT exam pages: smaller payload for faster Gemini vision turnaround. */
export const JLPT_IMAGE_PREP = {
  maxEdge: 960,
  quality: 0.58,
  minQuality: 0.42,
  /** ~300KB binary → keeps JSON upload and Gemini latency down. */
  maxBase64Chars: 400_000,
} as const;

export type PrepareImageOptions = {
  maxEdge?: number;
  quality?: number;
  minQuality?: number;
  maxBase64Chars?: number;
};

export async function fileToJpegBase64(
  file: File,
  options?: PrepareImageOptions,
): Promise<{ base64: string; previewUrl: string }> {
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

  const maxEdge = options?.maxEdge ?? MAX_EDGE;
  const startQuality = options?.quality ?? 0.72;
  const minQuality = options?.minQuality ?? startQuality;
  const maxBase64Chars = options?.maxBase64Chars;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    throw new Error("Couldn't prepare the photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = startQuality;
  let previewUrl = canvas.toDataURL("image/jpeg", quality);
  let base64 = previewUrl.split(",")[1] ?? "";

  while (
    maxBase64Chars != null &&
    base64.length > maxBase64Chars &&
    quality > minQuality + 0.01
  ) {
    quality = Math.max(minQuality, quality - 0.08);
    previewUrl = canvas.toDataURL("image/jpeg", quality);
    base64 = previewUrl.split(",")[1] ?? "";
  }

  if (!base64) throw new Error("Couldn't prepare the photo.");
  return { base64, previewUrl };
}

/** Compress/resize a JLPT exam photo before `/api/analyze-jlpt`. */
export function fileToJpegBase64ForJlpt(file: File) {
  return fileToJpegBase64(file, JLPT_IMAGE_PREP);
}
