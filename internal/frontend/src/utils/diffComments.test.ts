import { describe, expect, it } from "vitest";
import { formatDiffComment, formatDiffComments, normalizeDiffCommentRange } from "./diffComments";
import type { DiffComment } from "./diffComments";

const baseComment: DiffComment = {
  id: "c1",
  fileId: "abc12345",
  filePath: "docs/README.md",
  side: "additions",
  startLine: 12,
  endLine: 12,
  text: "Please clarify this section.",
  createdAt: 1,
  replies: [],
};

describe("normalizeDiffCommentRange", () => {
  it("sorts line ranges", () => {
    expect(normalizeDiffCommentRange(9, 3)).toEqual([3, 9]);
  });
});

describe("formatDiffComment", () => {
  it("formats a single-line comment", () => {
    expect(formatDiffComment(baseComment)).toBe("docs/README.md:12:Please clarify this section.");
  });

  it("formats a multi-line comment", () => {
    expect(formatDiffComment({ ...baseComment, startLine: 12, endLine: 15 })).toBe(
      "docs/README.md:12-15:Please clarify this section.",
    );
  });
});

describe("formatDiffComments", () => {
  it("joins formatted comments with newlines", () => {
    expect(
      formatDiffComments([
        baseComment,
        {
          ...baseComment,
          id: "c2",
          startLine: 20,
          endLine: 21,
          text: "Second comment",
          replies: [],
        },
      ]),
    ).toBe("docs/README.md:12:Please clarify this section.\ndocs/README.md:20-21:Second comment");
  });

  it("includes replies and escapes embedded newlines", () => {
    expect(
      formatDiffComments([
        {
          ...baseComment,
          text: "Parent\ncomment",
          replies: [{ id: "r1", text: "Reply\ncomment", createdAt: 3 }],
        },
      ]),
    ).toBe("docs/README.md:12:Parent\\ncomment\ndocs/README.md:12:Reply\\ncomment");
  });
});
