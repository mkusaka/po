import { useEffect } from "react";

interface ConfirmFileRemovalDialogProps {
  uploaded?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmFileRemovalDialog({
  uploaded,
  onCancel,
  onConfirm,
}: ConfirmFileRemovalDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const title = uploaded ? "Discard uploaded file?" : "Close file?";
  const body = uploaded
    ? "This will remove the uploaded file from this po session. You may need to upload it again to restore it."
    : "This will remove the file from this po session. The file on disk will not be deleted.";
  const confirmLabel = uploaded ? "Discard" : "Close file";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-file-removal-title"
        className="w-full max-w-sm rounded-md border border-gh-border bg-gh-bg p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-file-removal-title" className="text-base font-semibold text-gh-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gh-text-secondary">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gh-border bg-transparent px-3 py-1.5 text-sm text-gh-text-secondary transition-colors duration-150 hover:bg-gh-bg-hover hover:text-gh-text"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--borderColor-danger-emphasis)] bg-[var(--fgColor-danger)] px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
