import { Suspense } from "react";
import { DeskFallback } from "@/components/desk-fallback";
import { SumiApp } from "@/components/sumi-app";

export default function Page() {
  return (
    <Suspense fallback={<DeskFallback />}>
      <SumiApp />
    </Suspense>
  );
}
