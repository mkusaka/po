import { useState } from "react";
import { RemoveIcon } from "./RemoveIcon";
import { ConfirmFileRemovalDialog } from "./ConfirmFileRemovalDialog";

interface CloseFileButtonProps {
  onClose: () => void;
  uploaded?: boolean;
}

export function CloseFileButton({ onClose, uploaded }: CloseFileButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-text-secondary cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover"
        onClick={() => setConfirmOpen(true)}
        aria-label={uploaded ? "Discard uploaded file" : "Close file"}
        title={uploaded ? "Discard uploaded file" : "Close file"}
      >
        <RemoveIcon uploaded={uploaded} />
      </button>
      {confirmOpen && (
        <ConfirmFileRemovalDialog
          uploaded={uploaded}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
