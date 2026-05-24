export interface FileEntry {
  name: string;
  id: string;
  path: string;
  relativePath?: string;
  title?: string;
  updatedAt?: string;
  uploaded?: boolean;
}

export interface Group {
  name: string;
  files: FileEntry[];
}

export interface FileContent {
  content: string;
  baseDir: string;
}

export interface VersionInfo {
  version: string;
  revision: string;
}

export interface SearchAnchor {
  kind: string;
  value: string;
}

export interface SearchMatch {
  line: number;
  column?: number;
  text: string;
  before?: string[];
  after?: string[];
  heading?: string;
  anchor: SearchAnchor;
}

export interface SearchResult {
  fileId: string;
  fileName: string;
  title?: string;
  path: string;
  relativePath?: string;
  uploaded: boolean;
  matches: SearchMatch[];
}

export interface SearchResponse {
  query: string;
  group: string;
  limit: number;
  context: number;
  total: number;
  results: SearchResult[];
}

export interface StatusResponse {
  version: string;
  revision: string;
  pid: number;
  repoScope?: {
    root: string;
    name: string;
  };
  agenticSearch?: {
    enabled: boolean;
  };
}

export interface AgenticSearchResponse {
  query: string;
  group?: string;
  repoRoot: string;
  repoName: string;
  answer: string;
  elapsedMs: number;
}

export interface AgenticSearchHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgenticSearchStreamEvent =
  | { type: "started" }
  | { type: "output_delta"; delta: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "progress"; message: string }
  | ({ type: "completed" } & AgenticSearchResponse)
  | { type: "error"; message: string };

export type AgenticSearchStreamHandler = (event: AgenticSearchStreamEvent) => void;

function groupPath(group: string): string {
  return `/_/api/groups/${encodeURIComponent(group)}`;
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch("/_/api/groups");
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

export async function fetchFileContent(group: string, id: string): Promise<FileContent> {
  const res = await fetch(`${groupPath(group)}/files/${id}/content`);
  if (!res.ok) throw new Error("Failed to fetch file content");
  return res.json();
}

export async function openRelativeFile(
  group: string,
  fileId: string,
  relativePath: string,
): Promise<FileEntry> {
  const res = await fetch(`${groupPath(group)}/files/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, path: relativePath }),
  });
  if (!res.ok) throw new Error("Failed to open file");
  return res.json();
}

export async function openFileInEditor(
  group: string,
  fileId: string,
  editor: string,
): Promise<void> {
  const res = await fetch(`${groupPath(group)}/files/${fileId}/editor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editor }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || "Failed to open file in editor");
  }
}

export async function removeFile(group: string, id: string): Promise<void> {
  const res = await fetch(`${groupPath(group)}/files/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove file");
}

export async function reorderFiles(groupName: string, fileIds: string[]): Promise<void> {
  const res = await fetch(`${groupPath(groupName)}/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder files");
}

export async function moveFile(
  sourceGroup: string,
  id: string,
  targetGroup: string,
): Promise<void> {
  const res = await fetch(`${groupPath(sourceGroup)}/files/${id}/group`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group: targetGroup }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || "Failed to move file");
  }
}

export async function uploadFile(name: string, content: string, group: string): Promise<void> {
  const res = await fetch(`${groupPath(group)}/files/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || "Failed to upload file");
  }
}

export async function restartServer(): Promise<void> {
  const res = await fetch("/_/api/restart", { method: "POST" });
  if (!res.ok) throw new Error("Failed to restart server");
}

export async function fetchVersion(): Promise<VersionInfo> {
  const res = await fetch("/_/api/version");
  if (!res.ok) throw new Error("Failed to fetch version");
  return res.json();
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch("/_/api/status");
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function fetchSearchResults(
  query: string,
  group: string,
  limit = 50,
  context = 2,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    group,
    limit: String(limit),
    context: String(context),
  });
  const res = await fetch(`/_/api/search?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to search file contents");
  return res.json();
}

export async function runAgenticSearch(
  query: string,
  group: string,
  onEvent?: AgenticSearchStreamHandler,
  history: AgenticSearchHistoryMessage[] = [],
): Promise<AgenticSearchResponse> {
  const res = await fetch("/_/api/agentic-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(onEvent ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify({ query, group, ...(history.length > 0 ? { history } : {}) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || "Failed to run agentic search");
  }
  if (!onEvent) {
    return res.json();
  }
  if (!res.body) {
    throw new Error("Agentic search stream is unavailable");
  }

  let completed: AgenticSearchResponse | null = null;
  let streamError: Error | null = null;
  await readAgenticSearchEvents(res.body, (event) => {
    onEvent(event);
    if (event.type === "completed") {
      completed = {
        query: event.query,
        group: event.group,
        repoRoot: event.repoRoot,
        repoName: event.repoName,
        answer: event.answer,
        elapsedMs: event.elapsedMs,
      };
    } else if (event.type === "error") {
      streamError = new Error(event.message);
    }
  });
  if (streamError) {
    throw streamError;
  }
  if (!completed) {
    throw new Error("Agentic search stream ended before completion");
  }
  return completed;
}

async function readAgenticSearchEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: AgenticSearchStreamHandler,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatchAgenticSearchEvent(buffer.slice(0, boundary), onEvent);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) {
    dispatchAgenticSearchEvent(buffer, onEvent);
  }
}

function dispatchAgenticSearchEvent(raw: string, onEvent: AgenticSearchStreamHandler) {
  const data = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return;
  onEvent(JSON.parse(data) as AgenticSearchStreamEvent);
}
