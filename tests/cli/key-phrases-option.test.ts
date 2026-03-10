import { describe, expect, it } from "bun:test";
import {
  resolveKeyPhrasesOption,
  type KeyPhrasesOutputMode,
} from "../../src/cli/key-phrases-option";

describe("resolveKeyPhrasesOption", () => {
  it("disables key-phrases when flag is not provided", () => {
    expect(resolveKeyPhrasesOption(undefined, false)).toEqual({
      enabled: false,
      mode: null,
      maxPhrases: null,
    });
  });

  it("uses default preview mode for bare flag", () => {
    expect(resolveKeyPhrasesOption("", true)).toEqual({
      enabled: true,
      mode: "preview",
      maxPhrases: 8,
    });
  });

  it("accepts declared output modes", () => {
    const modes: KeyPhrasesOutputMode[] = ["preview", "list"];
    for (const mode of modes) {
      expect(resolveKeyPhrasesOption(mode, true)).toEqual({
        enabled: true,
        mode,
        maxPhrases: 8,
      });
    }
  });

  it("normalizes case and whitespace", () => {
    expect(resolveKeyPhrasesOption("  LIST ", true)).toEqual({
      enabled: true,
      mode: "list",
      maxPhrases: 8,
    });
  });

  it("uses last value for duplicate parsed arrays", () => {
    expect(resolveKeyPhrasesOption(["preview", "list"], true)).toEqual({
      enabled: true,
      mode: "list",
      maxPhrases: 8,
    });
  });

  it("fails closed for unsupported values", () => {
    expect(() => resolveKeyPhrasesOption("deep", true)).toThrow(
      "Invalid --key-phrases value"
    );
  });
});
