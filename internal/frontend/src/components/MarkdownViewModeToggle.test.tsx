import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownViewModeToggle } from "./MarkdownViewModeToggle";

describe("MarkdownViewModeToggle", () => {
  it("marks the active view mode", () => {
    render(<MarkdownViewModeToggle mode="diff" onChange={() => {}} canRenderMarkdown />);

    expect(screen.getByRole("button", { name: "Diff view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Markdown view" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("changes to code view when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MarkdownViewModeToggle mode="md" onChange={onChange} canRenderMarkdown />);

    await user.click(screen.getByRole("button", { name: "Code view" }));

    expect(onChange).toHaveBeenCalledWith("code");
  });

  it("disables markdown mode for non-markdown files", () => {
    render(<MarkdownViewModeToggle mode="code" onChange={() => {}} canRenderMarkdown={false} />);

    expect(screen.getByRole("button", { name: "Markdown view" })).toBeDisabled();
  });
});
