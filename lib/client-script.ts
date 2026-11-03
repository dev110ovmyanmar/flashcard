import { getAnalysisCache, setAnalysisCache } from "@/lib/analysis-cache";
import type { ScriptGrammarItem, ScriptVocabItem } from "@/src/constants/scriptPrompt";

export type ScriptAnalyzeSuccess = {
  ok: true;
  source: "gemini" | "cache";
  message: string;
  vocabulary: ScriptVocabItem[];
  grammar: ScriptGrammarItem[];
  rawText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccess(value: unknown): value is ScriptAnalyzeSuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.source === "gemini" || value.source === "cache") &&
    typeof value.message === "string" &&
    Array.isArray(value.vocabulary) &&
    Array.isArray(value.grammar) &&
    typeof value.rawText === "string"
  );
}

async function parseAnalyzeResponse(response: Response): Promise<ScriptAnalyzeSuccess> {
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
        : "The script couldn't be analyzed.";
    throw new Error(message);
  }

  return {
    ...data,
    source: "gemini",
  };
}

export async function requestScriptAnalyze(
  scriptText: string,
  signal?: AbortSignal,
): Promise<ScriptAnalyzeSuccess> {
  const material = scriptText.trim();
  const cached = await getAnalysisCache<ScriptAnalyzeSuccess>("script-text", material);
  if (cached && Array.isArray(cached.vocabulary) && Array.isArray(cached.grammar)) {
    return {
      ...cached,
      ok: true,
      source: "cache",
      message: cached.message || "Loaded from cache.",
    };
  }

  const response = await fetch("/api/analyze-script", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scriptText }),
    signal,
  });
  const result = await parseAnalyzeResponse(response);
  void setAnalysisCache("script-text", material, result);
  return result;
}

export async function requestScriptAnalyzeImage(
  imageBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<ScriptAnalyzeSuccess> {
  const material = `${mimeType}:${imageBase64}`;
  const cached = await getAnalysisCache<ScriptAnalyzeSuccess>("script-image", material);
  if (cached && Array.isArray(cached.vocabulary) && Array.isArray(cached.grammar)) {
    return {
      ...cached,
      ok: true,
      source: "cache",
      message: cached.message || "Loaded from cache.",
    };
  }

  const response = await fetch("/api/analyze-script", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
    signal,
  });
  const result = await parseAnalyzeResponse(response);
  void setAnalysisCache("script-image", material, result);
  return result;
}

export async function fetchScriptAnalyzeStatus(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/analyze-script", { signal });
  const data: unknown = await response.json();
  return isRecord(data) && data.configured === true;
}
