import { describe, expect, it } from "bun:test";
import {
  DEFAULT_TEXT_SCALE,
  resolveTextScale,
  TEXT_SCALE_PRESETS,
} from "../../src/cli/text-scale-option";

describe("resolveTextScale", () => {
  it("uses the default preset when value is undefined", () => {
    expect(resolveTextScale(undefined)).toBe(DEFAULT_TEXT_SCALE);
  });

  it("accepts all declared presets", () => {
    for (const preset of TEXT_SCALE_PRESETS) {
      expect(resolveTextScale(preset)).toBe(preset);
    }
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(resolveTextScale("  LARGE ")).toBe("large");
  });

  it("uses last value when duplicate flags are parsed as an array", () => {
    expect(resolveTextScale(["small", "large"])).toBe("large");
  });

  it("throws for unsupported values", () => {
    expect(() => resolveTextScale("huge")).toThrow("Invalid --text-scale value");
  });

  it("throws for missing value forms like boolean true", () => {
    expect(() => resolveTextScale(true)).toThrow("Invalid --text-scale value");
  });
});
