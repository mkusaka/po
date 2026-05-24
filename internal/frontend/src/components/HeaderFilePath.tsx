import { useCallback, useRef, useState } from "react";

interface HeaderFilePathProps {
  path: string;
  isRelative: boolean;
}

const COPY_RESET_DELAY_MS = 2000;

export function HeaderFilePath({ path, isRelative }: HeaderFilePathProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = isRelative ? "Copy relative path" : "Copy file path";
  const copied = copiedPath === path;

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(path)
      .then(() => {
        setCopiedPath(path);
        if (resetTimerRef.current != null) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => {
          setCopiedPath((current) => (current === path ? null : current));
          resetTimerRef.current = null;
        }, COPY_RESET_DELAY_MS);
      })
      .catch(() => {});
  }, [path]);

  if (!path) return <div className="min-w-0 flex-1" />;

  return (
    <div className="min-w-0 flex flex-1 items-center gap-1.5 text-sm">
      <span
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-gh-header-text/90"
        title={path}
      >
        {path}
      </span>
      <button
        type="button"
        className="shrink-0 flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1 text-gh-header-text cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover"
        onClick={handleCopy}
        aria-label={label}
        title={copied ? "Copied" : label}
      >
        {copied ? (
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="10" height="10" rx="1.5" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
