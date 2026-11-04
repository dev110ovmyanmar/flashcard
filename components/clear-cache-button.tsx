"use client";

import { DatabaseZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearAnalysisCache } from "@/lib/analysis-cache";

export function ClearCacheButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8 rounded-lg border-border/70 bg-card/80 shadow-none transition-all duration-200 hover:bg-muted/70 active:scale-[0.98]"
      aria-label="Clear analysis cache"
      title="Clear cache"
      onClick={() => {
        const cleared = clearAnalysisCache();
        if (cleared === 0) {
          toast.message("Cache is already empty");
          return;
        }
        toast.success(`Cleared ${cleared} cached result${cleared === 1 ? "" : "s"}`);
      }}
    >
      <DatabaseZap aria-hidden />
    </Button>
  );
}
