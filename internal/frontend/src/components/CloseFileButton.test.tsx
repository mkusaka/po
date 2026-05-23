import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseFileButton } from "./CloseFileButton";

describe("CloseFileButton", () => {
  it("confirms before closing a regular file", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloseFileButton onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close file" }));

    const dialog = screen.getByRole("dialog", { name: "Close file?" });
    expect(dialog).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Close file" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses discard wording for uploaded files", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloseFileButton onClose={onClose} uploaded />);

    await user.click(screen.getByRole("button", { name: "Discard uploaded file" }));

    expect(screen.getByRole("dialog", { name: "Discard uploaded file?" })).toBeInTheDocument();
    expect(screen.getByText(/You may need to upload it again/)).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
