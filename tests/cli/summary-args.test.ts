import { describe, expect, it } from "bun:test";
import {
  DEFAULT_SUMMARY_PRESET,
  resolveSummaryOption,
  SUMMARY_PRESETS,
} from "../../src/cli/summary-option";

describe("resolveSummaryOption", () => {
  it("disables summary mode when flag is not provided", () => {
    expect(resolveSummaryOption(undefined, false)).toEqual({
      enabled: false,
      preset: null,
    });
  });

  it("uses medium preset when flag is provided without a value", () => {
    expect(resolveSummaryOption("", true)).toEqual({
      enabled: true,
      preset: DEFAULT_SUMMARY_PRESET,
    });
  });

  it("accepts all declared summary presets", () => {
    for (const preset of SUMMARY_PRESETS) {
      expect(resolveSummaryOption(preset, true)).toEqual({
        enabled: true,
        preset,
      });
    }
  });

  it("normalizes case and whitespace", () => {
    expect(resolveSummaryOption("  LONG ", true)).toEqual({
      enabled: true,
      preset: "long",
    });
  });

  it("uses the last value when duplicate flags are parsed as arrays", () => {
    expect(resolveSummaryOption(["short", "medium"], true)).toEqual({
      enabled: true,
      preset: "medium",
    });
  });

  it("throws for unsupported values", () => {
    expect(() => resolveSummaryOption("huge", true)).toThrow(
      "Invalid --summary value"
    );
  });
});
