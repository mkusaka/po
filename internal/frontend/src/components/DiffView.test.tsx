import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { DiffView } from "./DiffView";
import { fetchFileDiff } from "../hooks/useApi";
import type { DiffComment } from "../utils/diffComments";

vi.mock("../hooks/useApi", () => ({
  fetchFileDiff: vi.fn(),
}));

vi.mock("@pierre/diffs/react", () => ({
  MultiFileDiff: ({
    options,
    lineAnnotations,
    renderAnnotation,
  }: {
    options: {
      onLineNumberClick?: (line: { annotationSide: "additions"; lineNumber: number }) => void;
    };
    lineAnnotations?: Array<{ metadata?: DiffComment }>;
    renderAnnotation?: (annotation: { metadata?: DiffComment }) => ReactNode;
  }) => (
    <div data-testid="diff">
      <button
        type="button"
        onClick={() => options.onLineNumberClick?.({ annotationSide: "additions", lineNumber: 3 })}
      >
        Line 3
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
  vi.mocked(fetchFileDiff).mockResolvedValue({
    fileName: "README.md",
    relativePath: "README.md",
    baseRef: "HEAD",
    baseExists: true,
    oldContent: "# Old\n",
    newContent: "# New\n",
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText,
    },
  });
});

describe("DiffView", () => {
  it("adds a comment for the selected line", async () => {
    const user = userEvent.setup();
    const onAddComment = vi.fn();
    render(
      <DiffView
        activeGroup="default"
        fileId="abc12345"
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

    await screen.findByTestId("diff");
    await user.click(screen.getByRole("button", { name: "Line 3" }));
    await user.type(screen.getByRole("textbox", { name: "Comment" }), "Please update");
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onAddComment).toHaveBeenCalledWith({
      fileId: "abc12345",
      filePath: "README.md",
      side: "additions",
      startLine: 3,
      endLine: 3,
      text: "Please update",
      replies: [],
    });
  });

  it("copies all comments in line-oriented format", async () => {
    const comments: DiffComment[] = [
      {
        id: "c1",
        fileId: "abc12345",
        filePath: "README.md",
        side: "additions",
        startLine: 2,
        endLine: 4,
        text: "Tighten this wording",
        createdAt: 1,
        replies: [],
      },
    ];
    render(
      <DiffView
        activeGroup="default"
        fileId="abc12345"
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

    await screen.findByTestId("diff");
    fireEvent.click(screen.getByRole("button", { name: "Copy all comments" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("README.md:2-4:Tighten this wording");
    });
  });

  it("edits comments and adds replies", async () => {
    const user = userEvent.setup();
    const onUpdateComment = vi.fn();
    const onAddReply = vi.fn();
    const comments: DiffComment[] = [
      {
        id: "c1",
        fileId: "abc12345",
        filePath: "README.md",
        side: "additions",
        startLine: 2,
        endLine: 2,
        text: "Original",
        createdAt: 1,
        replies: [],
      },
    ];
    render(
      <DiffView
        activeGroup="default"
        fileId="abc12345"
        revision={0}
        comments={comments}
        onAddComment={() => {}}
        onUpdateComment={onUpdateComment}
        onDeleteComment={() => {}}
        onAddReply={onAddReply}
        onUpdateReply={() => {}}
        onDeleteReply={() => {}}
      />,
    );

    await screen.findByTestId("diff");
    await user.click(screen.getByRole("button", { name: "Edit comment" }));
    const editBox = screen.getByRole("textbox", { name: "Edit comment" });
    await user.clear(editBox);
    await user.type(editBox, "Updated");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateComment).toHaveBeenCalledWith("c1", "Updated");

    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "Looks good");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onAddReply).toHaveBeenCalledWith("c1", "Looks good");
  });
});
