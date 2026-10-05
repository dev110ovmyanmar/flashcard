export function DeskFallback() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="h-10 w-28 animate-pulse rounded-full bg-card" />
        <div className="size-9 animate-pulse rounded-full bg-card" />
      </div>
      <p className="mt-16 text-sm text-muted-foreground">Loading your decks…</p>
    </div>
  );
}
