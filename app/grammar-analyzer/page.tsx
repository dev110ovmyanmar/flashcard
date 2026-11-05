import type { Metadata } from "next";
import { GrammarAnalyzer } from "@/components/grammar-analyzer";

export const metadata: Metadata = {
  description:
    "Upload a JLPT grammar or star (★) question page and get Burmese explanations of patterns and answers.",
};

export default function GrammarAnalyzerPage() {
  return <GrammarAnalyzer />;
}
