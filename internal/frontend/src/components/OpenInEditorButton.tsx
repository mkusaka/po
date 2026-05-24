import { useCallback, useMemo, useRef, useState } from "react";
import { openFileInEditor } from "../hooks/useApi";

export const EDITOR_OPEN_STORAGE_KEY = "po-open-editor";

interface EditorOption {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

const EDITORS: EditorOption[] = [
  { id: "vscode", label: "VS Code", shortLabel: "VS", description: "Open current file in VS Code" },
  {
    id: "vscode-insiders",
    label: "VS Code Insiders",
    shortLabel: "VI",
    description: "Open current file in VS Code Insiders",
  },
  { id: "cursor", label: "Cursor", shortLabel: "CU", description: "Open current file in Cursor" },
  { id: "zed", label: "Zed", shortLabel: "ZE", description: "Open current file in Zed" },
  { id: "finder", label: "Finder", shortLabel: "FI", description: "Reveal current file in Finder" },
  {
    id: "terminal",
    label: "Terminal",
    shortLabel: "TE",
    description: "Open current file folder in Terminal",
  },
  {
    id: "iterm2",
    label: "iTerm2",
    shortLabel: "IT",
    description: "Open current file folder in iTerm2",
  },
  {
    id: "ghostty",
    label: "Ghostty",
    shortLabel: "GH",
    description: "Open current file folder in Ghostty",
  },
  { id: "warp", label: "Warp", shortLabel: "WA", description: "Open current file folder in Warp" },
  { id: "xcode", label: "Xcode", shortLabel: "XC", description: "Open current file in Xcode" },
  { id: "rider", label: "Rider", shortLabel: "RI", description: "Open current file in Rider" },
  { id: "goland", label: "GoLand", shortLabel: "GO", description: "Open current file in GoLand" },
  {
    id: "webstorm",
    label: "WebStorm",
    shortLabel: "WS",
    description: "Open current file in WebStorm",
  },
];

function getInitialEditorId() {
  try {
    const stored = localStorage.getItem(EDITOR_OPEN_STORAGE_KEY);
    if (stored && EDITORS.some((editor) => editor.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return "vscode";
}

interface OpenInEditorButtonProps {
  group: string;
  fileId: string | null;
  uploaded?: boolean;
}

export function OpenInEditorButton({ group, fileId, uploaded }: OpenInEditorButtonProps) {
  const [selectedEditorId, setSelectedEditorId] = useState(getInitialEditorId);
  const [status, setStatus] = useState<"idle" | "opening" | "opened" | "error">("idle");
  const [prevFileId, setPrevFileId] = useState(fileId);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (fileId !== prevFileId) {
    setPrevFileId(fileId);
    setStatus("idle");
  }

  const selectedEditor = useMemo(
    () => EDITORS.find((editor) => editor.id === selectedEditorId) ?? EDITORS[0],
    [selectedEditorId],
  );
  const disabled = fileId == null || uploaded === true || status === "opening";
  const mainTitle =
    uploaded === true ? "Uploaded files cannot be opened in an editor" : selectedEditor.description;

  const handleSelect = useCallback((editorId: string) => {
    setSelectedEditorId(editorId);
    setStatus("idle");
    try {
      localStorage.setItem(EDITOR_OPEN_STORAGE_KEY, editorId);
    } catch {
      /* ignore */
    }
    detailsRef.current?.removeAttribute("open");
  }, []);

  const handleOpen = useCallback(() => {
    if (fileId == null || disabled) return;
    setStatus("opening");
    openFileInEditor(group, fileId, selectedEditor.id)
      .then(() => setStatus("opened"))
      .catch(() => setStatus("error"));
  }, [disabled, fileId, group, selectedEditor.id]);

  const buttonLabel =
    status === "opening"
      ? `Opening current file in ${selectedEditor.label}`
      : selectedEditor.description;

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        className="flex items-center justify-center bg-transparent border border-gh-border rounded-l-md border-r-0 p-1.5 cursor-pointer text-gh-header-text transition-colors duration-150 hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleOpen}
        disabled={disabled}
        aria-label={buttonLabel}
        title={
          status === "opened"
            ? `Opened in ${selectedEditor.label}`
            : status === "error"
              ? "Failed to open editor"
              : mainTitle
        }
      >
        {status === "opened" ? <CheckIcon /> : status === "error" ? <AlertIcon /> : <EditorIcon />}
      </button>
      <details
        ref={detailsRef}
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.removeAttribute("open");
          }
        }}
      >
        <summary
          className="flex list-none items-center justify-center bg-transparent border border-gh-border rounded-r-md p-1.5 cursor-pointer text-gh-header-text transition-colors duration-150 hover:bg-gh-bg-hover [&::-webkit-details-marker]:hidden"
          aria-label="Choose editor"
          title={`Choose editor: ${selectedEditor.label}`}
        >
          <ChevronDownIcon />
        </summary>
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-md border border-gh-border bg-gh-bg-secondary py-1 shadow-lg"
        >
          {EDITORS.map((editor) => (
            <button
              key={editor.id}
              type="button"
              role="menuitemradio"
              aria-checked={editor.id === selectedEditor.id}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gh-text transition-colors hover:bg-gh-bg-hover"
              onClick={() => handleSelect(editor.id)}
              title={editor.description}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-gh-border bg-gh-bg text-[10px] font-semibold text-gh-text-secondary">
                {editor.shortLabel}
              </span>
              <span className="min-w-0 flex-1 truncate">{editor.label}</span>
              {editor.id === selectedEditor.id && <CheckIcon className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

function EditorIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 16 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h7v7" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    </svg>
  );
}

function CheckIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.3 4.3 2.7 18a1.5 1.5 0 0 0 1.3 2.2h16a1.5 1.5 0 0 0 1.3-2.2L13.7 4.3a2 2 0 0 0-3.4 0Z"
      />
    </svg>
  );
}
