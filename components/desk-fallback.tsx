export function DeskFallback() {
  return (
    <div className="mx-auto flex min-h-[50dvh] w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <div className="flex h-12 items-center justify-between sm:h-14">
        <div className="h-8 w-28 animate-pulse rounded-full bg-muted/60" />
        <div className="size-8 animate-pulse rounded-lg bg-muted/60" />
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Loading your decks…</p>
    </div>
  );
}
