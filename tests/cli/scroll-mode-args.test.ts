import { describe, expect, it } from "bun:test";
import {
  READING_MODES,
  resolveReadingMode,
} from "../../src/cli/mode-option";

describe("scroll mode CLI args", () => {
  it("includes scroll in READING_MODES tuple", () => {
    expect(READING_MODES).toContain("scroll");
  });

  it("resolves --mode scroll to scroll", () => {
    expect(resolveReadingMode("scroll")).toBe("scroll");
  });

  it("normalizes case and whitespace for scroll", () => {
    expect(resolveReadingMode("  SCROLL ")).toBe("scroll");
    expect(resolveReadingMode("Scroll")).toBe("scroll");
  });

  it("uses last value when duplicate flags include scroll", () => {
    expect(resolveReadingMode(["rsvp", "scroll"])).toBe("scroll");
    expect(resolveReadingMode(["scroll", "chunked"])).toBe("chunked");
  });

  it("still rejects invalid mode values", () => {
    expect(() => resolveReadingMode("teleprompter")).toThrow("Invalid --mode value");
  });

  it("error message includes scroll in valid modes list", () => {
    try {
      resolveReadingMode("invalid");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("scroll");
    }
  });
});
