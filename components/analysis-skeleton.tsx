"use client";

const shimmer =
  "relative overflow-hidden rounded-xl border border-border/50 bg-card/70 shadow-xs before:absolute before:inset-0 before:-translate-x-full before:animate-[sumi-shimmer_1.4s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent dark:border-border/40 dark:before:via-white/10";

function Bone({ className = "" }: { className?: string }) {
  return <div className={["rounded-md bg-muted/50", className].join(" ")} aria-hidden />;
}

export function AnalysisSkeleton({
  label = "Analyzing…",
  cards = 3,
  variant = "cards",
}: {
  label?: string;
  cards?: number;
  variant?: "cards" | "vocab-grid";
}) {
  return (
    <section className="space-y-3 sm:space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Working
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">{label}</h2>
        </div>
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary/70" aria-hidden />
      </div>

      {variant === "vocab-grid" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className={[shimmer, "p-4 sm:p-5"].join(" ")}>
              <Bone className="h-5 w-16" />
              <Bone className="mt-3 h-7 w-2/3" />
              <Bone className="mt-4 h-3 w-full" />
              <Bone className="mt-2 h-3 w-5/6" />
              <Bone className="mt-4 h-12 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className={[shimmer, "p-4 sm:p-5"].join(" ")}>
              <div className="flex items-center gap-2">
                <Bone className="h-5 w-14" />
                <Bone className="h-5 w-10" />
              </div>
              <Bone className="mt-3 h-6 w-4/5" />
              <Bone className="mt-3 h-3 w-full" />
              <Bone className="mt-2 h-3 w-11/12" />
              <Bone className="mt-4 h-16 w-full" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
