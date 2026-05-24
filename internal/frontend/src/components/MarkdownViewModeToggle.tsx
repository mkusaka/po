import type { ReactNode } from "react";

export type MarkdownViewMode = "md" | "code" | "diff";

interface MarkdownViewModeToggleProps {
  mode: MarkdownViewMode;
  onChange: (mode: MarkdownViewMode) => void;
  canRenderMarkdown: boolean;
}

const VIEW_MODES: { mode: MarkdownViewMode; label: string; title: string; icon: ReactNode }[] = [
  {
    mode: "md",
    label: "Markdown view",
    title: "Show Markdown",
    icon: (
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5.25h16M4 9.75h10M4 14.25h16M4 18.75h10"
        />
      </svg>
    ),
  },
  {
    mode: "code",
    label: "Code view",
    title: "Show code",
    icon: (
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
        />
      </svg>
    ),
  },
  {
    mode: "diff",
    label: "Diff view",
    title: "Show diff",
    icon: (
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5v15M17 4.5v15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.25h5M4.5 15.75h5M14.5 12h5" />
      </svg>
    ),
  },
];

export function MarkdownViewModeToggle({
  mode,
  onChange,
  canRenderMarkdown,
}: MarkdownViewModeToggleProps) {
  return (
    <div
      className="inline-flex flex-col overflow-hidden border border-gh-border rounded-md bg-transparent"
      role="group"
      aria-label="Markdown view mode"
    >
      {VIEW_MODES.map((item, index) => {
        const active = item.mode === mode;
        const disabled = item.mode === "md" && !canRenderMarkdown;
        return (
          <button
            key={item.mode}
            type="button"
            className={`flex items-center justify-center p-1.5 cursor-pointer transition-colors duration-150 ${
              index > 0 ? "border-t border-gh-border" : ""
            } ${
              active
                ? "bg-gh-bg-active text-gh-text"
                : "bg-transparent text-gh-text-secondary hover:bg-gh-bg-hover"
            } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
            onClick={() => onChange(item.mode)}
            disabled={disabled}
            aria-label={item.label}
            aria-pressed={active}
            title={disabled ? "Markdown view is available for Markdown files" : item.title}
          >
            {item.icon}
          </button>
        );
      })}
    </div>
  );
}
