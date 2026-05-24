import type { FileEntry } from "../hooks/useApi";

export type FileSortMode = "default" | "updated";

const naturalCompare = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
}).compare;

export function isFileSortMode(value: unknown): value is FileSortMode {
  return value === "default" || value === "updated";
}

export function getFileUpdatedAtMs(file: FileEntry): number {
  if (!file.updatedAt) return 0;
  const time = Date.parse(file.updatedAt);
  return Number.isFinite(time) ? time : 0;
}

export function getFileSortPath(file: FileEntry): string {
  return file.relativePath ?? file.path ?? file.name;
}

export function compareFilesByUpdated(a: FileEntry, b: FileEntry): number {
  const updatedDiff = getFileUpdatedAtMs(b) - getFileUpdatedAtMs(a);
  if (updatedDiff !== 0) return updatedDiff;
  return naturalCompare(getFileSortPath(a), getFileSortPath(b));
}

export function sortFiles(files: FileEntry[], sortMode: FileSortMode): FileEntry[] {
  if (sortMode === "default") return files;
  return [...files].sort(compareFilesByUpdated);
}
