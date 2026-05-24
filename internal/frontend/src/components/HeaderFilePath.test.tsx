import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HeaderFilePath } from "./HeaderFilePath";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HeaderFilePath", () => {
  it("copies the path and returns to the copy icon after a delay", async () => {
    vi.useFakeTimers();
    render(<HeaderFilePath path="docs/guide.md" isRelative={true} />);

    const button = screen.getByLabelText("Copy relative path");

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("docs/guide.md");
    expect(button).toHaveAttribute("title", "Copied");
    expect(button.querySelector("svg")?.getAttribute("stroke-width")).toBe("2");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveAttribute("title", "Copy relative path");
    expect(button.querySelector("svg")?.getAttribute("stroke-width")).toBe("1.8");
  });
});
