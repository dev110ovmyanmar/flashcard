import { loadState, sanitizePersistedState, STORAGE_KEY } from "@/lib/storage";
import type { PersistedState } from "@/lib/types";

export const BACKUP_FORMAT = "sumi-goi-backup" as const;
export const BACKUP_VERSION = 1 as const;

export type GoiBackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  storageKey: string;
  state: PersistedState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildGoiBackup(state?: PersistedState, now = new Date()): GoiBackupFile {
  const current = state ?? {
    version: 1 as const,
    seeded: true,
    decks: loadState().decks,
  };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    storageKey: STORAGE_KEY,
    state: {
      version: 1,
      seeded: true,
      decks: current.decks,
    },
  };
}

export function serializeGoiBackup(backup: GoiBackupFile = buildGoiBackup()): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `sumi-goi-backup-${stamp}.json`;
}

export function downloadGoiBackup(filename = backupFilename()): GoiBackupFile {
  const backup = buildGoiBackup();
  const blob = new Blob([serializeGoiBackup(backup)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return backup;
}

/**
 * Accepts either a Sumi backup envelope or a raw PersistedState / { decks: [...] } file.
 * Does not write to localStorage — caller decides when to apply.
 */
export function parseGoiBackup(raw: string): PersistedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("That backup file has an unexpected shape.");
  }

  if (parsed.format === BACKUP_FORMAT) {
    const state = sanitizePersistedState(parsed.state);
    if (!state) throw new Error("That Sumi backup is missing decks.");
    return { ...state, seeded: true };
  }

  if (Array.isArray(parsed.decks)) {
    const state = sanitizePersistedState(parsed);
    if (!state) throw new Error("That backup could not be read.");
    return { ...state, seeded: true };
  }

  throw new Error("Unrecognized backup. Export a Sumi Goi JSON file and try again.");
}

export async function readBackupFile(file: File): Promise<PersistedState> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".json") && file.type && !file.type.includes("json") && file.type !== "") {
    throw new Error("Choose a .json backup file.");
  }
  const text = await file.text();
  return parseGoiBackup(text);
}
