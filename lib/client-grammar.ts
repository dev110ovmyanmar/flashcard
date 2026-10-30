import type { GrammarQuestion } from "@/src/constants/grammarPrompt";

export type GrammarAnalyzeSuccess = {
  ok: true;
  source: "gemini";
  message: string;
  questions: GrammarQuestion[];
  rawText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccess(value: unknown): value is GrammarAnalyzeSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    value.source === "gemini" &&
    typeof value.message === "string" &&
    Array.isArray(value.questions) &&
    typeof value.rawText === "string"
  );
}

/** Upload a prepared JPEG as multipart FormData (preferred by the grammar API). */
export async function requestGrammarAnalyze(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<GrammarAnalyzeSuccess> {
  const decoded = atob(imageBase64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "image/jpeg" });
  const form = new FormData();
  form.append("image", blob, "grammar-page.jpg");

  const response = await fetch("/api/analyze-grammar", {
    method: "POST",
    body: form,
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
        : "The grammar page couldn't be analyzed.";
    throw new Error(message);
  }

  return data;
}

export async function fetchGrammarAnalyzeStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/analyze-grammar", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
