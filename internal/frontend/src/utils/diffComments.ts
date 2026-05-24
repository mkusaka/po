import type { AnnotationSide } from "@pierre/diffs/react";

export interface DiffComment {
  id: string;
  fileId: string;
  filePath: string;
  side: AnnotationSide;
  startLine: number;
  endLine: number;
  text: string;
  createdAt: number;
}

export interface DiffCommentDraft {
  side: AnnotationSide;
  startLine: number;
  endLine: number;
}

export function normalizeDiffCommentRange(startLine: number, endLine: number): [number, number] {
  return startLine <= endLine ? [startLine, endLine] : [endLine, startLine];
}

export function formatDiffComment(comment: DiffComment): string {
  const [start, end] = normalizeDiffCommentRange(comment.startLine, comment.endLine);
  const lineRange = start === end ? String(start) : `${start}-${end}`;
  return `${comment.filePath}:${lineRange}:${comment.text}`;
}

export function formatDiffComments(comments: DiffComment[]): string {
  return comments.map(formatDiffComment).join("\n");
}

export function readStoredDiffComments(storageKey: string): Record<string, DiffComment[]> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, DiffComment[]> = {};
    for (const [fileId, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const comments = value.filter(isDiffComment);
      if (comments.length > 0) {
        result[fileId] = comments;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function isDiffComment(value: unknown): value is DiffComment {
  if (!value || typeof value !== "object") return false;
  const comment = value as Record<string, unknown>;
  return (
    typeof comment.id === "string" &&
    typeof comment.fileId === "string" &&
    typeof comment.filePath === "string" &&
    (comment.side === "additions" || comment.side === "deletions") &&
    typeof comment.startLine === "number" &&
    typeof comment.endLine === "number" &&
    typeof comment.text === "string" &&
    typeof comment.createdAt === "number"
  );
}
