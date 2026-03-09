import { describe, expect, it } from "bun:test";
import { resolveTranslateOption } from "../../src/cli/translate-option";

describe("resolveTranslateOption", () => {
  it("disables translate mode when flag is not provided", () => {
    expect(resolveTranslateOption(undefined, false)).toEqual({
      enabled: false,
      target: null,
    });
  });

  it("normalizes target values from string input", () => {
    expect(resolveTranslateOption("  ENGLISH  ", true)).toEqual({
      enabled: true,
      target: "english",
    });
  });

  it("uses last target when duplicate flags are parsed as arrays", () => {
    expect(resolveTranslateOption(["spanish", "fr"], true)).toEqual({
      enabled: true,
      target: "fr",
    });
  });

  it("fails closed for missing translate target value", () => {
    expect(() => resolveTranslateOption("", true)).toThrow("Invalid --translate-to value");
  });

  it("fails closed for oversized translate target values", () => {
    expect(() => resolveTranslateOption("x".repeat(65), true)).toThrow(
      "Invalid --translate-to value"
    );
  });
});
