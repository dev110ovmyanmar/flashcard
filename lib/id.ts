export function uid(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  const rand =
    cryptoApi && typeof cryptoApi.randomUUID === "function"
      ? cryptoApi.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand}`;
}
