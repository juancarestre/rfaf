import { describe, expect, it } from "bun:test";
import { sanitizeTerminalText } from "../../src/ui/sanitize-terminal-text";

describe("sanitizeTerminalText", () => {
  it("removes ANSI color escape sequences", () => {
    const input = "normal \u001b[31mred\u001b[0m text";
    expect(sanitizeTerminalText(input)).toBe("normal red text");
  });

  it("removes OSC sequences", () => {
    const input = "safe\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007";
    expect(sanitizeTerminalText(input)).toBe("safelink");
  });

  it("removes control characters but keeps newlines and tabs", () => {
    const input = "hello\u0000\u0008\n\tworld";
    expect(sanitizeTerminalText(input)).toBe("hello\n\tworld");
  });

  it("removes carriage-return characters to prevent terminal line spoofing", () => {
    const input = "safe\rspoofed";
    expect(sanitizeTerminalText(input)).toBe("safespoofed");
  });
});
