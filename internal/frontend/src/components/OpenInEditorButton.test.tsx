import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpenInEditorButton, EDITOR_OPEN_STORAGE_KEY } from "./OpenInEditorButton";
import { openFileInEditor } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
  openFileInEditor: vi.fn(),
}));

describe("OpenInEditorButton", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(openFileInEditor).mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens the current file in the selected editor", async () => {
    const user = userEvent.setup();
    render(<OpenInEditorButton group="default" fileId="aaa11111" />);

    await user.click(screen.getByLabelText("Open current file in VS Code"));

    expect(openFileInEditor).toHaveBeenCalledWith("default", "aaa11111", "vscode");
    await waitFor(() => {
      expect(screen.getByTitle("Opened in VS Code")).toBeInTheDocument();
    });
  });

  it("selects and persists an editor", async () => {
    const user = userEvent.setup();
    render(<OpenInEditorButton group="default" fileId="aaa11111" />);

    await user.click(screen.getByLabelText("Choose editor"));
    await user.click(screen.getByRole("menuitemradio", { name: /Zed/ }));
    await user.click(screen.getByLabelText("Open current file in Zed"));

    expect(localStorage.getItem(EDITOR_OPEN_STORAGE_KEY)).toBe("zed");
    expect(openFileInEditor).toHaveBeenCalledWith("default", "aaa11111", "zed");
  });

  it("resets opened feedback when the active file changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OpenInEditorButton group="default" fileId="aaa11111" />);

    await user.click(screen.getByLabelText("Open current file in VS Code"));
    await waitFor(() => {
      expect(screen.getByTitle("Opened in VS Code")).toBeInTheDocument();
    });

    rerender(<OpenInEditorButton group="default" fileId="bbb22222" />);

    expect(screen.getByLabelText("Open current file in VS Code")).toHaveAttribute(
      "title",
      "Open current file in VS Code",
    );
  });

  it("disables opening uploaded files", async () => {
    const user = userEvent.setup();
    render(<OpenInEditorButton group="default" fileId="uploaded111" uploaded />);

    const button = screen.getByLabelText("Open current file in VS Code");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Uploaded files cannot be opened in an editor");

    await user.click(button);
    expect(openFileInEditor).not.toHaveBeenCalled();
  });
});
