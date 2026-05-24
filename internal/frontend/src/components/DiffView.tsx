import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MultiFileDiff } from "@pierre/diffs/react";
import type {
  AnnotationSide,
  DiffLineAnnotation,
  MultiFileDiffProps,
  SelectedLineRange,
} from "@pierre/diffs/react";
import { fetchFileDiff } from "../hooks/useApi";
import type { FileDiffContent } from "../hooks/useApi";
import {
  formatDiffComments,
  normalizeDiffCommentRange,
  type DiffComment,
  type DiffCommentDraft,
} from "../utils/diffComments";

interface DiffViewProps {
  activeGroup: string;
  fileId: string;
  revision: number;
  comments: DiffComment[];
  onAddComment: (draft: Omit<DiffComment, "id" | "createdAt">) => void;
  onDeleteComment: (commentId: string) => void;
}

type DiffOptions = NonNullable<MultiFileDiffProps<DiffComment>["options"]>;
type DiffLineClickHandler = NonNullable<DiffOptions["onLineNumberClick"]>;
type DiffSelectionHandler = NonNullable<DiffOptions["onLineSelectionEnd"]>;

export function DiffView({
  activeGroup,
  fileId,
  revision,
  comments,
  onAddComment,
  onDeleteComment,
}: DiffViewProps) {
  const [diff, setDiff] = useState<FileDiffContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<DiffCommentDraft | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFileDiff(activeGroup, fileId)
      .then((data) => {
        if (!cancelled) {
          setDiff(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDiff(null);
          setError(err instanceof Error ? err.message : "Failed to fetch file diff");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroup, fileId, revision]);

  useEffect(() => {
    setTarget(null);
    setDraft("");
  }, [fileId]);

  const setTargetRange = useCallback((side: AnnotationSide, startLine: number, endLine: number) => {
    const [start, end] = normalizeDiffCommentRange(startLine, endLine);
    setTarget({ side, startLine: start, endLine: end });
  }, []);

  const handleLineClick = useCallback<DiffLineClickHandler>(
    (line) => {
      setTargetRange(line.annotationSide, line.lineNumber, line.lineNumber);
    },
    [setTargetRange],
  );

  const handleSelectionEnd = useCallback<DiffSelectionHandler>(
    (range) => {
      const normalized = normalizeSelectionRange(range);
      if (normalized) {
        setTargetRange(normalized.side, normalized.startLine, normalized.endLine);
      }
    },
    [setTargetRange],
  );

  const selectedLines = useMemo<SelectedLineRange | null>(() => {
    if (!target) return null;
    return {
      start: target.startLine,
      side: target.side,
      end: target.endLine,
      endSide: target.side,
    };
  }, [target]);

  const lineAnnotations = useMemo<DiffLineAnnotation<DiffComment>[]>(
    () =>
      comments.map((comment) => ({
        side: comment.side,
        lineNumber: comment.startLine,
        metadata: comment,
      })),
    [comments],
  );

  const options = useMemo<DiffOptions>(
    () => ({
      diffStyle: "split",
      diffIndicators: "classic",
      lineDiffType: "word",
      overflow: "wrap",
      hunkSeparators: "line-info-basic",
      collapsedContextThreshold: 160,
      lineHoverHighlight: "both",
      enableLineSelection: true,
      controlledSelection: true,
      theme: {
        light: "pierre-light",
        dark: "pierre-dark",
      },
      themeType: "system",
      onLineClick: handleLineClick,
      onLineNumberClick: handleLineClick,
      onLineSelectionEnd: handleSelectionEnd,
    }),
    [handleLineClick, handleSelectionEnd],
  );

  const handleAddComment = useCallback(() => {
    const text = draft.trim();
    if (!target || !diff || !text) return;
    onAddComment({
      fileId,
      filePath: diff.relativePath || diff.fileName,
      side: target.side,
      startLine: target.startLine,
      endLine: target.endLine,
      text,
    });
    setDraft("");
  }, [diff, draft, fileId, onAddComment, target]);

  const handleCopyComments = useCallback(async () => {
    if (comments.length === 0) return;
    await navigator.clipboard.writeText(formatDiffComments(comments));
    setCopied(true);
    if (copyTimerRef.current != null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
  }, [comments]);

  const fileLabel = diff?.relativePath || diff?.fileName || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-50 text-gh-text-secondary text-sm">
        Loading diff...
      </div>
    );
  }

  if (error || !diff) {
    return (
      <div className="flex items-center justify-center h-50 text-gh-text-secondary text-sm">
        {error ?? "Diff is not available."}
      </div>
    );
  }

  return (
    <div className="po-diff-layout">
      <div className="po-diff-view min-w-0 flex-1">
        {!diff.baseExists && (
          <div className="mb-3 border border-gh-border bg-gh-bg-secondary px-3 py-2 text-sm text-gh-text-secondary">
            {diff.relativePath} is not in {diff.baseRef}.
          </div>
        )}
        <MultiFileDiff<DiffComment>
          oldFile={{
            name: diff.relativePath,
            contents: diff.oldContent,
            cacheKey: `${fileId}:${revision}:old:${diff.baseExists ? "base" : "empty"}`,
          }}
          newFile={{
            name: diff.relativePath,
            contents: diff.newContent,
            cacheKey: `${fileId}:${revision}:new`,
          }}
          options={options}
          lineAnnotations={lineAnnotations}
          selectedLines={selectedLines}
          renderAnnotation={(annotation) =>
            annotation.metadata ? <DiffCommentAnnotation comment={annotation.metadata} /> : null
          }
          disableWorkerPool
        />
      </div>
      <DiffCommentsPanel
        fileLabel={fileLabel}
        target={target}
        draft={draft}
        comments={comments}
        copied={copied}
        onDraftChange={setDraft}
        onAddComment={handleAddComment}
        onCopyComments={handleCopyComments}
        onDeleteComment={onDeleteComment}
      />
    </div>
  );
}

function normalizeSelectionRange(range: SelectedLineRange | null): DiffCommentDraft | null {
  if (!range) return null;
  const side = range.side ?? "additions";
  const endSide = range.endSide ?? side;
  if (side !== endSide) return null;
  const [startLine, endLine] = normalizeDiffCommentRange(range.start, range.end);
  return { side, startLine, endLine };
}

function DiffCommentAnnotation({ comment }: { comment: DiffComment }) {
  return (
    <div className="my-2 rounded-md border border-gh-border bg-gh-bg-secondary px-3 py-2 text-sm text-gh-text">
      <div className="mb-1 text-xs text-gh-text-secondary">{formatLineRange(comment)}</div>
      <div className="whitespace-pre-wrap break-words">{comment.text}</div>
    </div>
  );
}

function DiffCommentsPanel({
  fileLabel,
  target,
  draft,
  comments,
  copied,
  onDraftChange,
  onAddComment,
  onCopyComments,
  onDeleteComment,
}: {
  fileLabel: string;
  target: DiffCommentDraft | null;
  draft: string;
  comments: DiffComment[];
  copied: boolean;
  onDraftChange: (value: string) => void;
  onAddComment: () => void;
  onCopyComments: () => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const canAdd = target != null && draft.trim().length > 0;
  return (
    <aside className="po-diff-comments shrink-0 border-l border-gh-border bg-gh-bg px-4 py-3 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gh-text">Comments</h2>
        <button
          type="button"
          className="flex items-center justify-center rounded-md border border-gh-border bg-transparent p-1.5 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCopyComments}
          disabled={comments.length === 0}
          aria-label="Copy all comments"
          title="Copy all comments"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {target && (
        <div className="mb-4 border-b border-gh-border pb-4">
          <div className="mb-2 truncate font-mono text-xs text-gh-text-secondary" title={fileLabel}>
            {fileLabel}:{formatTargetLineRange(target)}
          </div>
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-gh-border bg-gh-bg-secondary px-2 py-1.5 text-sm text-gh-text outline-none focus:border-gh-text-secondary"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Comment"
            aria-label="Comment"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-gh-border bg-gh-bg-secondary px-3 py-1.5 text-sm text-gh-text transition-colors duration-150 hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onAddComment}
              disabled={!canAdd}
            >
              Add comment
            </button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-sm text-gh-text-secondary">No comments</div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border-b border-gh-border pb-3 last:border-b-0">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0 truncate font-mono text-xs text-gh-text-secondary">
                  {formatDiffCommentHeader(comment)}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
                  onClick={() => onDeleteComment(comment.id)}
                  aria-label="Delete comment"
                  title="Delete comment"
                >
                  <RemoveIcon />
                </button>
              </div>
              <div className="whitespace-pre-wrap break-words text-gh-text">{comment.text}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function formatDiffCommentHeader(comment: DiffComment): string {
  return `${comment.filePath}:${formatLineRange(comment)}`;
}

function formatTargetLineRange(target: DiffCommentDraft): string {
  const [start, end] = normalizeDiffCommentRange(target.startLine, target.endLine);
  return start === end ? String(start) : `${start}-${end}`;
}

function formatLineRange(comment: Pick<DiffComment, "startLine" | "endLine">): string {
  const [start, end] = normalizeDiffCommentRange(comment.startLine, comment.endLine);
  return start === end ? String(start) : `${start}-${end}`;
}

function CopyIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25ZM5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}
