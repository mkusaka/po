import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownViewModeToggle } from "./MarkdownViewModeToggle";

describe("MarkdownViewModeToggle", () => {
  it("marks the active view mode", () => {
    render(<MarkdownViewModeToggle mode="diff" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Diff view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Rendered view" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("changes to raw view when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MarkdownViewModeToggle mode="rendered" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Raw view" }));

    expect(onChange).toHaveBeenCalledWith("raw");
  });
});
