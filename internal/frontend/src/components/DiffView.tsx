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
  isDiffCommentSide,
  normalizeDiffCommentRange,
  type DiffComment,
  type DiffCommentDraft,
} from "../utils/diffComments";
import {
  CommentAnnotation,
  CommentThreadPanel,
  copyCommentsToClipboard,
} from "./CommentThreadPanel";

interface DiffViewProps {
  activeGroup: string;
  fileId: string;
  revision: number;
  comments: DiffComment[];
  onAddComment: (draft: Omit<DiffComment, "id" | "createdAt">) => void;
  onUpdateComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAddReply: (commentId: string, text: string) => void;
  onUpdateReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
}

type DiffOptions = NonNullable<MultiFileDiffProps<DiffComment>["options"]>;
type DiffLineClickHandler = NonNullable<DiffOptions["onLineNumberClick"]>;
type DiffSelectionHandler = NonNullable<DiffOptions["onLineSelectionEnd"]>;
type DiffCommentTarget = DiffCommentDraft & { side: AnnotationSide };

export function DiffView({
  activeGroup,
  fileId,
  revision,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: DiffViewProps) {
  const [diff, setDiff] = useState<FileDiffContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<DiffCommentTarget | null>(null);
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
      comments
        .filter((comment): comment is DiffComment & { side: AnnotationSide } =>
          isDiffCommentSide(comment.side),
        )
        .map((comment) => ({
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
      replies: [],
    });
    setDraft("");
  }, [diff, draft, fileId, onAddComment, target]);

  const handleCopyComments = useCallback(async () => {
    copyCommentsToClipboard(comments, setCopied, copyTimerRef);
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
            annotation.metadata ? <CommentAnnotation comment={annotation.metadata} /> : null
          }
          disableWorkerPool
        />
      </div>
      <CommentThreadPanel
        fileLabel={fileLabel}
        target={target}
        draft={draft}
        comments={comments}
        copied={copied}
        onDraftChange={setDraft}
        onAddComment={handleAddComment}
        onCopyComments={handleCopyComments}
        onUpdateComment={onUpdateComment}
        onDeleteComment={onDeleteComment}
        onAddReply={onAddReply}
        onUpdateReply={onUpdateReply}
        onDeleteReply={onDeleteReply}
      />
    </div>
  );
}

function normalizeSelectionRange(range: SelectedLineRange | null): DiffCommentTarget | null {
  if (!range) return null;
  const side = range.side ?? "additions";
  const endSide = range.endSide ?? side;
  if (side !== endSide) return null;
  const [startLine, endLine] = normalizeDiffCommentRange(range.start, range.end);
  return { side, startLine, endLine };
}
