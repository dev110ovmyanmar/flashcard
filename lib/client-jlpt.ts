import { getAnalysisCache, setAnalysisCache } from "@/lib/analysis-cache";
import type { JlptQuestion } from "@/src/constants/jlptPrompt";

export type JlptAnalyzeSuccess = {
  ok: true;
  source: "gemini" | "cache";
  message: string;
  questions: JlptQuestion[];
  rawText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccess(value: unknown): value is JlptAnalyzeSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.source === "gemini" || value.source === "cache") &&
    typeof value.message === "string" &&
    Array.isArray(value.questions) &&
    typeof value.rawText === "string"
  );
}

export async function requestJlptAnalyze(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<JlptAnalyzeSuccess> {
  const material = `${mimeType}:${imageBase64}`;
  const cached = await getAnalysisCache<JlptAnalyzeSuccess>("jlpt", material);
  if (cached && Array.isArray(cached.questions)) {
    return {
      ...cached,
      ok: true,
      source: "cache",
      message: cached.message || "Loaded from cache.",
    };
  }

  const response = await fetch("/api/analyze-jlpt", {
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
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "The exam paper couldn't be analyzed.";
    throw new Error(message);
  }

  const result: JlptAnalyzeSuccess = {
    ...data,
    source: "gemini",
  };
  void setAnalysisCache("jlpt", material, result);
  return result;
}

export async function fetchJlptAnalyzeStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/analyze-jlpt", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
