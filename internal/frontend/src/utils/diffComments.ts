import type { AnnotationSide } from "@pierre/diffs/react";

export type FileCommentSide = AnnotationSide | "file";

export interface FileCommentReply {
  id: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export interface DiffComment {
  id: string;
  fileId: string;
  filePath: string;
  side: FileCommentSide;
  startLine: number;
  endLine: number;
  text: string;
  createdAt: number;
  updatedAt?: number;
  replies: FileCommentReply[];
}

export interface DiffCommentDraft {
  side: FileCommentSide;
  startLine: number;
  endLine: number;
}

export function normalizeDiffCommentRange(startLine: number, endLine: number): [number, number] {
  return startLine <= endLine ? [startLine, endLine] : [endLine, startLine];
}

export function formatDiffComment(comment: DiffComment): string {
  const [start, end] = normalizeDiffCommentRange(comment.startLine, comment.endLine);
  const lineRange = start === end ? String(start) : `${start}-${end}`;
  return `${comment.filePath}:${lineRange}:${formatCommentText(comment.text)}`;
}

export function formatDiffComments(comments: DiffComment[]): string {
  return comments
    .flatMap((comment) => [formatDiffComment(comment), ...formatReplies(comment)])
    .join("\n");
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
      const comments = value
        .map(normalizeStoredComment)
        .filter((comment): comment is DiffComment => comment != null);
      if (comments.length > 0) {
        result[fileId] = comments;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function isDiffCommentSide(side: FileCommentSide): side is AnnotationSide {
  return side === "additions" || side === "deletions";
}

function formatReplies(comment: DiffComment): string[] {
  const [start, end] = normalizeDiffCommentRange(comment.startLine, comment.endLine);
  const lineRange = start === end ? String(start) : `${start}-${end}`;
  return comment.replies.map(
    (reply) => `${comment.filePath}:${lineRange}:${formatCommentText(reply.text)}`,
  );
}

function formatCommentText(text: string): string {
  return text.replace(/\r?\n/g, "\\n");
}

function normalizeStoredComment(value: unknown): DiffComment | null {
  if (!value || typeof value !== "object") return null;
  const comment = value as Record<string, unknown>;
  if (
    typeof comment.id === "string" &&
    typeof comment.fileId === "string" &&
    typeof comment.filePath === "string" &&
    (comment.side === "additions" || comment.side === "deletions" || comment.side === "file") &&
    typeof comment.startLine === "number" &&
    typeof comment.endLine === "number" &&
    typeof comment.text === "string" &&
    typeof comment.createdAt === "number"
  ) {
    const replies = Array.isArray(comment.replies)
      ? comment.replies.filter(isFileCommentReply)
      : [];
    return {
      id: comment.id,
      fileId: comment.fileId,
      filePath: comment.filePath,
      side: comment.side,
      startLine: comment.startLine,
      endLine: comment.endLine,
      text: comment.text,
      createdAt: comment.createdAt,
      updatedAt: typeof comment.updatedAt === "number" ? comment.updatedAt : undefined,
      replies,
    };
  }
  return null;
}

function isFileCommentReply(value: unknown): value is FileCommentReply {
  if (!value || typeof value !== "object") return false;
  const reply = value as Record<string, unknown>;
  return (
    typeof reply.id === "string" &&
    typeof reply.text === "string" &&
    typeof reply.createdAt === "number"
  );
}
