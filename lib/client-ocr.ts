import { getAnalysisCache, setAnalysisCache } from "@/lib/analysis-cache";
import type { OcrSuccess } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccess(value: unknown): value is OcrSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.source === "gemini" || value.source === "mock") &&
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
  const material = `${mimeType}:${imageBase64}`;
  const cached = await getAnalysisCache<OcrSuccess>("ocr", material);
  if (cached && Array.isArray(cached.rows)) {
    return {
      ...cached,
      ok: true,
      source: cached.source === "mock" ? "mock" : "gemini",
      message: cached.message ? `${cached.message} (cached)` : "Loaded from cache.",
    };
  }

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

  void setAnalysisCache("ocr", material, data);
  return data;
}

export async function fetchOcrStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/ocr", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
