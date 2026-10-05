import type { OcrSuccess } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccess(value: unknown): value is OcrSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.source === "vision" || value.source === "mock") &&
    typeof value.message === "string" &&
    Array.isArray(value.rows) &&
    typeof value.rawText === "string"
  );
}

export async function requestOcr(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<OcrSuccess> {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
    signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !isSuccess(data)) {
    const message =
      isRecord(data) && typeof data.error === "string" ? data.error : "The page couldn't be read.";
    throw new Error(message);
  }

  return data;
}

export async function fetchVisionStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/ocr", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
