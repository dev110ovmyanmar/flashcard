const MAX_EDGE = 1280;
const MAX_BYTES = 12 * 1024 * 1024;

export async function fileToJpegBase64(file: File): Promise<{ base64: string; previewUrl: string }> {
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

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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

  const previewUrl = canvas.toDataURL("image/jpeg", 0.72);
  const base64 = previewUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("Couldn't prepare the photo.");
  return { base64, previewUrl };
}
