import type { Group } from "../hooks/useApi";
import type { FileEntry } from "../hooks/useApi";

export function allFileIds(groups: Group[]): Set<string> {
  const ids = new Set<string>();
  for (const g of groups) {
    for (const f of g.files) {
      ids.add(f.id);
    }
  }
  return ids;
}

export function parseGroupFromPath(pathname: string): string {
  const path = pathname.replace(/^\//, "").replace(/\/$/, "");
  return path || "default";
}

export function groupToPath(groupName: string): string {
  return groupName === "default" ? "/" : `/${groupName}`;
}

export function buildFileUrl(groupName: string, fileId: string): string {
  return `${groupToPath(groupName)}?file=${encodeFileParam(fileId)}`;
}

export function parseFileIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("file");
  if (raw == null || raw === "") return null;
  return raw;
}

export function fileUrlParam(file: Pick<FileEntry, "id" | "relativePath">): string {
  return file.relativePath || file.id;
}

export function buildFileEntryUrl(
  groupName: string,
  file: Pick<FileEntry, "id" | "relativePath">,
): string {
  return buildFileUrl(groupName, fileUrlParam(file));
}

export function resolveFileParam(
  files: FileEntry[],
  fileParam: string | null | undefined,
): FileEntry | undefined {
  if (!fileParam) return undefined;
  const normalized = fileParam.replace(/\\/g, "/").replace(/^\.?\//, "");
  return files.find((f) => f.id === fileParam || f.relativePath === normalized);
}

function encodeFileParam(fileParam: string): string {
  return encodeURIComponent(fileParam).replace(/%2F/g, "/");
}
