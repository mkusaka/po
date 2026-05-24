import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MarkdownViewer } from "./MarkdownViewer";
import { fetchFileContent } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
  fetchFileContent: vi.fn(),
  openRelativeFile: vi.fn(),
}));

vi.mock("./CodeFileView", () => ({
  CodeFileView: ({ filePath }: { filePath: string }) => (
    <div data-testid="code-view">{filePath}</div>
  ),
}));

vi.mock("./DiffView", () => ({
  DiffView: () => <div data-testid="diff-view" />,
}));

beforeEach(() => {
  vi.mocked(fetchFileContent).mockResolvedValue({ content: "# Hello", baseDir: "/tmp" });
  window.history.replaceState(null, "", "/default?file=README.md");
});

describe("MarkdownViewer view mode query", () => {
  it("defaults markdown files to md mode and writes the query param", async () => {
    renderMarkdownViewer({ fileName: "README.md" });

    await waitFor(() => {
      expect(window.location.search).toContain("mode=md");
    });
  });

  it("uses code mode from the query param", async () => {
    window.history.replaceState(null, "", "/default?file=README.md&mode=code");

    renderMarkdownViewer({ fileName: "README.md", filePath: "docs/README.md" });

    expect(await screen.findByTestId("code-view")).toHaveTextContent("docs/README.md");
    expect(window.location.search).toContain("mode=code");
  });

  it("uses diff mode from the query param", async () => {
    window.history.replaceState(null, "", "/default?file=README.md&mode=diff");

    renderMarkdownViewer({ fileName: "README.md" });

    expect(await screen.findByTestId("diff-view")).toBeInTheDocument();
    expect(window.location.search).toContain("mode=diff");
  });

  it("falls back to code mode for non-markdown files", async () => {
    window.history.replaceState(null, "", "/default?file=main.go&mode=md");

    renderMarkdownViewer({ fileName: "main.go", filePath: "src/main.go" });

    expect(await screen.findByTestId("code-view")).toHaveTextContent("src/main.go");
    await waitFor(() => {
      expect(window.location.search).toContain("mode=code");
    });
  });
});

function renderMarkdownViewer({
  fileName,
  filePath = fileName,
}: {
  fileName: string;
  filePath?: string;
}) {
  return render(
    <MarkdownViewer
      fileId="abc12345"
      fileName={fileName}
      filePath={filePath}
      activeGroup="default"
      revision={0}
      onFileOpened={() => {}}
      onHeadingsChange={() => {}}
      isTocOpen={false}
      onTocToggle={() => {}}
      onRemoveFile={() => {}}
      isWide={false}
      fontSize="medium"
    />,
  );
}
