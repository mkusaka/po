import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { CodeFileView } from "./CodeFileView";
import type { DiffComment } from "../utils/diffComments";

vi.mock("@pierre/diffs/react", () => ({
  File: ({
    options,
    lineAnnotations,
    renderAnnotation,
  }: {
    options: {
      onLineNumberClick?: (line: { lineNumber: number }) => void;
    };
    lineAnnotations?: Array<{ metadata?: DiffComment }>;
    renderAnnotation?: (annotation: { metadata?: DiffComment }) => ReactNode;
  }) => (
    <div data-testid="code-file">
      <button type="button" onClick={() => options.onLineNumberClick?.({ lineNumber: 5 })}>
        Line 5
      </button>
      {lineAnnotations?.map((annotation) => (
        <div key={annotation.metadata?.id}>{renderAnnotation?.(annotation)}</div>
      ))}
    </div>
  ),
}));

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText,
    },
  });
});

describe("CodeFileView", () => {
  it("adds a file comment for any selected line", async () => {
    const user = userEvent.setup();
    const onAddComment = vi.fn();
    render(
      <CodeFileView
        fileId="abc12345"
        fileName="README.md"
        filePath="docs/README.md"
        content="# Hello"
        revision={0}
        comments={[]}
        onAddComment={onAddComment}
        onUpdateComment={() => {}}
        onDeleteComment={() => {}}
        onAddReply={() => {}}
        onUpdateReply={() => {}}
        onDeleteReply={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Line 5" }));
    await user.type(screen.getByRole("textbox", { name: "Comment" }), "Review this");
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onAddComment).toHaveBeenCalledWith({
      fileId: "abc12345",
      filePath: "docs/README.md",
      side: "file",
      startLine: 5,
      endLine: 5,
      text: "Review this",
      replies: [],
    });
  });

  it("copies comments and replies", async () => {
    const comments: DiffComment[] = [
      {
        id: "c1",
        fileId: "abc12345",
        filePath: "docs/README.md",
        side: "file",
        startLine: 3,
        endLine: 4,
        text: "Parent",
        createdAt: 1,
        replies: [{ id: "r1", text: "Reply", createdAt: 2 }],
      },
    ];
    render(
      <CodeFileView
        fileId="abc12345"
        fileName="README.md"
        filePath="docs/README.md"
        content="# Hello"
        revision={0}
        comments={comments}
        onAddComment={() => {}}
        onUpdateComment={() => {}}
        onDeleteComment={() => {}}
        onAddReply={() => {}}
        onUpdateReply={() => {}}
        onDeleteReply={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy all comments" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("docs/README.md:3-4:Parent\ndocs/README.md:3-4:Reply");
    });
  });
});
