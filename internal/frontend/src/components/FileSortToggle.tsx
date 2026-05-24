import type { FileSortMode } from "../utils/fileSort";

interface FileSortToggleProps {
  sortMode: FileSortMode;
  onToggle: () => void;
}

export function FileSortToggle({ sortMode, onToggle }: FileSortToggleProps) {
  const isUpdated = sortMode === "updated";

  return (
    <button
      type="button"
      className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-header-text cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover"
      onClick={onToggle}
      aria-label="File sort order"
      aria-pressed={isUpdated}
      title={isUpdated ? "Use default file order" : "Sort by updated time"}
    >
      {isUpdated ? (
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 14v5m0 0 2-2m-2 2-2-2" />
        </svg>
      ) : (
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
        </svg>
      )}
    </button>
  );
}
