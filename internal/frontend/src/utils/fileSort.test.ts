import { describe, expect, it } from "vitest";
import type { FileEntry } from "../hooks/useApi";
import { sortFiles } from "./fileSort";

function makeFile(id: string, path: string, updatedAt?: string): FileEntry {
  const name = path.split("/").pop()!;
  return { id, name, path, updatedAt };
}

describe("sortFiles", () => {
  it("keeps the current order for default mode", () => {
    const files = [
      makeFile("1", "/docs/b.md", "2026-01-02T00:00:00Z"),
      makeFile("2", "/docs/a.md", "2026-01-03T00:00:00Z"),
    ];

    expect(sortFiles(files, "default")).toBe(files);
  });

  it("sorts files by updated time descending", () => {
    const files = [
      makeFile("1", "/docs/old.md", "2026-01-01T00:00:00Z"),
      makeFile("2", "/docs/new.md", "2026-01-03T00:00:00Z"),
      makeFile("3", "/docs/mid.md", "2026-01-02T00:00:00Z"),
    ];

    expect(sortFiles(files, "updated").map((f) => f.name)).toEqual(["new.md", "mid.md", "old.md"]);
  });

  it("uses the path as a natural-order tie breaker", () => {
    const files = [
      makeFile("1", "/docs/i10.md", "2026-01-01T00:00:00Z"),
      makeFile("2", "/docs/i2.md", "2026-01-01T00:00:00Z"),
      makeFile("3", "/docs/i1.md", "2026-01-01T00:00:00Z"),
    ];

    expect(sortFiles(files, "updated").map((f) => f.name)).toEqual(["i1.md", "i2.md", "i10.md"]);
  });
});
