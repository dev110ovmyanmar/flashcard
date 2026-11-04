import { getAnalysisCache, setAnalysisCache } from "@/lib/analysis-cache";
import type { DokaiGlossaryEntry, DokaiQuestion } from "@/src/constants/dokaiPrompt";

export type DokaiAnalyzeSuccess = {
  ok: true;
  source: "gemini" | "cache";
  message: string;
  passage_text: string;
  summary_burmese: string;
  intent_burmese: string;
  glossary: DokaiGlossaryEntry[];
  questions: DokaiQuestion[];
  rawText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSnapSuccess(value: unknown): value is DokaiAnalyzeSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.source === "gemini" || value.source === "cache") &&
    typeof value.message === "string" &&
    typeof value.passage_text === "string" &&
    typeof value.summary_burmese === "string" &&
    typeof value.intent_burmese === "string" &&
    Array.isArray(value.questions) &&
    typeof value.rawText === "string"
  );
}

function withGlossary(data: DokaiAnalyzeSuccess): DokaiAnalyzeSuccess {
  return {
    ...data,
    glossary: Array.isArray(data.glossary) ? data.glossary : [],
  };
}

async function parseSnap(response: Response): Promise<DokaiAnalyzeSuccess> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || !isSnapSuccess(data)) {
    const message =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "The reading page couldn't be analyzed.";
    throw new Error(message);
  }
  return withGlossary({ ...data, source: "gemini" });
}

export async function requestDokaiAnalyzeImage(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<DokaiAnalyzeSuccess> {
  const material = `${mimeType}:${imageBase64}`;
  const cached = await getAnalysisCache<DokaiAnalyzeSuccess>("dokai-image", material);
  if (cached && Array.isArray(cached.questions)) {
    return withGlossary({
      ...cached,
      ok: true,
      source: "cache",
      message: cached.message || "Loaded from cache.",
    });
  }

  const decoded = atob(imageBase64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "image/jpeg" });
  const form = new FormData();
  form.append("image", blob, "dokai-page.jpg");

  const response = await fetch("/api/analyze-dokai", {
    method: "POST",
    body: form,
    signal,
  });
  const result = await parseSnap(response);
  void setAnalysisCache("dokai-image", material, result);
  return result;
}

export async function requestDokaiAnalyzeText(
  textInput: string,
  signal?: AbortSignal,
): Promise<DokaiAnalyzeSuccess> {
  const material = `text:${textInput.trim()}`;
  const cached = await getAnalysisCache<DokaiAnalyzeSuccess>("dokai-text", material);
  if (cached && Array.isArray(cached.questions)) {
    return withGlossary({
      ...cached,
      ok: true,
      source: "cache",
      message: cached.message || "Loaded from cache.",
    });
  }

  const response = await fetch("/api/analyze-dokai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ textInput }),
    signal,
  });
  const result = await parseSnap(response);
  void setAnalysisCache("dokai-text", material, result);
  return result;
}

export async function fetchDokaiAnalyzeStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/analyze-dokai", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
