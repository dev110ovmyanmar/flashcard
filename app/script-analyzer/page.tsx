import type { Metadata } from "next";
import { ScriptAnalyzer } from "@/components/script-analyzer";

export const metadata: Metadata = {
  description:
    "Paste a Japanese listening script and extract vocabulary (GOI) and grammar study notes.",
};

export default function ScriptAnalyzerPage() {
  return <ScriptAnalyzer />;
}
