import type { Metadata } from "next";
import { DokaiAnalyzer } from "@/components/dokai-analyzer";

export const metadata: Metadata = {
  description:
    "Upload a JLPT N2 reading (Dokai) page for OCR, Burmese summary, and correct vs wrong option analysis.",
};

export default function DokaiAnalyzerPage() {
  return <DokaiAnalyzer />;
}
