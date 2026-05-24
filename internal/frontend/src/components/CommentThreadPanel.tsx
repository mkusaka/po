import { useState } from "react";
import type { MutableRefObject } from "react";
import {
  formatDiffComments,
  normalizeDiffCommentRange,
  type DiffComment,
  type DiffCommentDraft,
} from "../utils/diffComments";

interface CommentThreadPanelProps {
  fileLabel: string;
  target: DiffCommentDraft | null;
  draft: string;
  comments: DiffComment[];
  copied: boolean;
  onDraftChange: (value: string) => void;
  onAddComment: () => void;
  onCopyComments: () => void;
  onUpdateComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAddReply: (commentId: string, text: string) => void;
  onUpdateReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
}

export function CommentThreadPanel({
  fileLabel,
  target,
  draft,
  comments,
  copied,
  onDraftChange,
  onAddComment,
  onCopyComments,
  onUpdateComment,
  onDeleteComment,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: CommentThreadPanelProps) {
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
            <CommentThread
              key={comment.id}
              comment={comment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onAddReply={onAddReply}
              onUpdateReply={onUpdateReply}
              onDeleteReply={onDeleteReply}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function CommentThread({
  comment,
  onUpdateComment,
  onDeleteComment,
  onAddReply,
  onUpdateReply,
  onDeleteReply,
}: {
  comment: DiffComment;
  onUpdateComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAddReply: (commentId: string, text: string) => void;
  onUpdateReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [replyDraft, setReplyDraft] = useState("");
  const [replying, setReplying] = useState(false);

  const saveEdit = () => {
    const text = editText.trim();
    if (!text) return;
    onUpdateComment(comment.id, text);
    setIsEditing(false);
  };

  const saveReply = () => {
    const text = replyDraft.trim();
    if (!text) return;
    onAddReply(comment.id, text);
    setReplyDraft("");
    setReplying(false);
  };

  return (
    <div className="border-b border-gh-border pb-3 last:border-b-0">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-xs text-gh-text-secondary">
          {formatDiffCommentHeader(comment)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={() => {
              setEditText(comment.text);
              setIsEditing(true);
            }}
            aria-label="Edit comment"
            title="Edit comment"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={() => onDeleteComment(comment.id)}
            aria-label="Delete comment"
            title="Delete comment"
          >
            <RemoveIcon />
          </button>
        </div>
      </div>
      {isEditing ? (
        <CommentEditor
          value={editText}
          onChange={setEditText}
          onSave={saveEdit}
          onCancel={() => setIsEditing(false)}
          label="Edit comment"
        />
      ) : (
        <div className="whitespace-pre-wrap break-words text-gh-text">{comment.text}</div>
      )}
      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-gh-border pl-3">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              commentId={comment.id}
              replyId={reply.id}
              text={reply.text}
              onUpdateReply={onUpdateReply}
              onDeleteReply={onDeleteReply}
            />
          ))}
        </div>
      )}
      {replying ? (
        <div className="mt-3">
          <CommentEditor
            value={replyDraft}
            onChange={setReplyDraft}
            onSave={saveReply}
            onCancel={() => {
              setReplyDraft("");
              setReplying(false);
            }}
            label="Reply"
          />
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
          onClick={() => setReplying(true)}
        >
          Reply
        </button>
      )}
    </div>
  );
}

function ReplyItem({
  commentId,
  replyId,
  text,
  onUpdateReply,
  onDeleteReply,
}: {
  commentId: string;
  replyId: string;
  text: string;
  onUpdateReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const saveEdit = () => {
    const next = editText.trim();
    if (!next) return;
    onUpdateReply(commentId, replyId, next);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <CommentEditor
        value={editText}
        onChange={setEditText}
        onSave={saveEdit}
        onCancel={() => setIsEditing(false)}
        label="Edit reply"
      />
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="whitespace-pre-wrap break-words text-gh-text">{text}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={() => {
              setEditText(text);
              setIsEditing(true);
            }}
            aria-label="Edit reply"
            title="Edit reply"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={() => onDeleteReply(commentId, replyId)}
            aria-label="Delete reply"
            title="Delete reply"
          >
            <RemoveIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentEditor({
  value,
  onChange,
  onSave,
  onCancel,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div>
      <textarea
        className="min-h-20 w-full resize-y rounded-md border border-gh-border bg-gh-bg-secondary px-2 py-1.5 text-sm text-gh-text outline-none focus:border-gh-text-secondary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md border border-gh-border bg-gh-bg-secondary px-2 py-1 text-xs text-gh-text transition-colors duration-150 hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSave}
          disabled={value.trim().length === 0}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function formatDiffCommentHeader(comment: DiffComment): string {
  return `${comment.filePath}:${formatLineRange(comment)}`;
}

function formatTargetLineRange(target: DiffCommentDraft): string {
  const [start, end] = normalizeDiffCommentRange(target.startLine, target.endLine);
  return start === end ? String(start) : `${start}-${end}`;
}

export function formatLineRange(comment: Pick<DiffComment, "startLine" | "endLine">): string {
  const [start, end] = normalizeDiffCommentRange(comment.startLine, comment.endLine);
  return start === end ? String(start) : `${start}-${end}`;
}

export function CommentAnnotation({ comment }: { comment: DiffComment }) {
  return (
    <div className="my-2 rounded-md border border-gh-border bg-gh-bg-secondary px-3 py-2 text-sm text-gh-text">
      <div className="mb-1 text-xs text-gh-text-secondary">{formatLineRange(comment)}</div>
      <div className="whitespace-pre-wrap break-words">{comment.text}</div>
      {comment.replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-gh-border pl-3 text-xs">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="whitespace-pre-wrap break-words">
              {reply.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function copyCommentsToClipboard(
  comments: DiffComment[],
  onCopied: (copied: boolean) => void,
  timerRef: MutableRefObject<number | null>,
) {
  if (comments.length === 0) return;
  navigator.clipboard
    .writeText(formatDiffComments(comments))
    .then(() => {
      onCopied(true);
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => onCopied(false), 1500);
    })
    .catch(() => {});
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

function EditIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.757Zm1.414 1.061a.25.25 0 0 0-.354 0l-.823.823 1.439 1.439.823-.823a.25.25 0 0 0 0-.354Zm-.799 3.323-1.439-1.439-6.725 6.725a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064Z" />
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
