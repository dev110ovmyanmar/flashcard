import type { Metadata } from "next";
import { JlptAnalyzer } from "@/components/jlpt-analyzer";

export const metadata: Metadata = {
  title: "Japanese Vocabulary Analyzer — Sumi",
  description: "Upload a Japanese exam or vocabulary page and extract structured study notes.",
};

export default function JlptAnalyzerPage() {
  return <JlptAnalyzer />;
}
