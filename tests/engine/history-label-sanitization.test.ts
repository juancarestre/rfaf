import { describe, expect, it } from "bun:test";
import {
  MAX_HISTORY_SOURCE_LABEL_LENGTH,
  sanitizeHistorySourceLabel,
} from "../../src/history/session-record";

describe("history source label sanitization", () => {
  it("removes ANSI, collapses whitespace, trims, and redacts full paths", () => {
    const input = "  \u001b[31m~/docs/article.md\u001b[0m\n\tpart 2\r\n  ";

    expect(sanitizeHistorySourceLabel(input)).toBe("article.md part 2");
  });

  it("redacts URL query and keeps host plus leaf path", () => {
    const input = "https://example.com/private/reports/q1?token=secret#top";

    expect(sanitizeHistorySourceLabel(input)).toBe("example.com/q1");
  });

  it("preserves known transform suffixes after privacy normalization", () => {
    const input = "~/docs/article.md (summary:medium)";

    expect(sanitizeHistorySourceLabel(input)).toBe("article.md (summary:medium)");
  });

  it("truncates long labels with ASCII ellipsis", () => {
    const input = "x".repeat(MAX_HISTORY_SOURCE_LABEL_LENGTH + 20);
    const sanitized = sanitizeHistorySourceLabel(input);

    expect(sanitized.length).toBe(MAX_HISTORY_SOURCE_LABEL_LENGTH);
    expect(sanitized.endsWith("...")).toBe(true);
  });

  it("falls back to Unknown source when result is blank", () => {
    expect(sanitizeHistorySourceLabel("\u001b[31m\u001b[0m\n\t")).toBe("Unknown source");
  });
});
