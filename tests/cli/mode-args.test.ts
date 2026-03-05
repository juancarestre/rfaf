import { describe, expect, it } from "bun:test";
import {
  DEFAULT_READING_MODE,
  READING_MODES,
  resolveReadingMode,
} from "../../src/cli/mode-option";

describe("resolveReadingMode", () => {
  it("uses default mode when undefined", () => {
    expect(resolveReadingMode(undefined)).toBe(DEFAULT_READING_MODE);
  });

  it("accepts all declared modes", () => {
    for (const mode of READING_MODES) {
      expect(resolveReadingMode(mode)).toBe(mode);
    }
  });

  it("normalizes case and whitespace", () => {
    expect(resolveReadingMode("  CHUNKED ")).toBe("chunked");
  });

  it("uses last value when duplicate flags are parsed as array", () => {
    expect(resolveReadingMode(["rsvp", "chunked"])).toBe("chunked");
  });

  it("throws for unsupported values", () => {
    expect(() => resolveReadingMode("bionic")).toThrow("Invalid --mode value");
  });
});
