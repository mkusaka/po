import { useCallback, useMemo, useRef, useState } from "react";
import { File } from "@pierre/diffs/react";
import type { FileOptions, LineAnnotation, SelectedLineRange } from "@pierre/diffs/react";
import {
  normalizeDiffCommentRange,
  type DiffComment,
  type DiffCommentDraft,
} from "../utils/diffComments";
import {
  CommentAnnotation,
  CommentThreadPanel,
  copyCommentsToClipboard,
} from "./CommentThreadPanel";

interface CodeFileViewProps {
  fileId: string;
  fileName: string;
  filePath: string;
  content: string;
  revision: number;
  comments: DiffComment[];
  onAddComment: (draft: Omit<DiffComment, "id" | "createdAt">) => void;
  onUpdateComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAddReply: (commentId: string, text: string) => void;
  onUpdateReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
}

type CodeOptions = FileOptions<DiffComment>;
type LineClickHandler = NonNullable<CodeOptions["onLineNumberClick"]>;
type SelectionHandler = NonNullable<CodeOptions["onLineSelectionEnd"]>;

export function CodeFileView({
  fileId,
  fileName,
  filePath,
  content,
  revision,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CodeFileViewProps) {
  const [target, setTarget] = useState<DiffCommentDraft | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const codeComments = useMemo(
    () => comments.filter((comment) => comment.side === "file"),
    [comments],
  );

  const setTargetRange = useCallback((startLine: number, endLine: number) => {
    const [start, end] = normalizeDiffCommentRange(startLine, endLine);
    setTarget({ side: "file", startLine: start, endLine: end });
  }, []);

  const handleLineClick = useCallback<LineClickHandler>(
    (line) => {
      setTargetRange(line.lineNumber, line.lineNumber);
    },
    [setTargetRange],
  );

  const handleSelectionEnd = useCallback<SelectionHandler>(
    (range) => {
      if (!range) return;
      setTargetRange(range.start, range.end);
    },
    [setTargetRange],
  );

  const selectedLines = useMemo<SelectedLineRange | null>(() => {
    if (!target) return null;
    return {
      start: target.startLine,
      end: target.endLine,
    };
  }, [target]);

  const lineAnnotations = useMemo<LineAnnotation<DiffComment>[]>(
    () =>
      codeComments.map((comment) => ({
        lineNumber: comment.startLine,
        metadata: comment,
      })),
    [codeComments],
  );

  const options = useMemo<CodeOptions>(
    () => ({
      overflow: "wrap",
      theme: {
        light: "pierre-light",
        dark: "pierre-dark",
      },
      themeType: "system",
      enableLineSelection: true,
      controlledSelection: true,
      lineHoverHighlight: "both",
      onLineClick: handleLineClick,
      onLineNumberClick: handleLineClick,
      onLineSelectionEnd: handleSelectionEnd,
    }),
    [handleLineClick, handleSelectionEnd],
  );

  const handleAddComment = useCallback(() => {
    const text = draft.trim();
    if (!target || !text) return;
    onAddComment({
      fileId,
      filePath,
      side: "file",
      startLine: target.startLine,
      endLine: target.endLine,
      text,
      replies: [],
    });
    setDraft("");
  }, [draft, fileId, filePath, onAddComment, target]);

  const handleCopyComments = useCallback(() => {
    copyCommentsToClipboard(comments, setCopied, copyTimerRef);
  }, [comments]);

  return (
    <div className="po-diff-layout">
      <div className="po-diff-view min-w-0 flex-1">
        <File<DiffComment>
          file={{
            name: filePath || fileName,
            contents: content,
            cacheKey: `${fileId}:${revision}:code`,
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
        fileLabel={filePath || fileName}
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
