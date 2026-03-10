import { describe, expect, it } from "bun:test";
import { resolveQuizOption } from "../../src/cli/quiz-option";

describe("resolveQuizOption", () => {
  it("disables quiz when flag is absent or false", () => {
    expect(resolveQuizOption(undefined)).toEqual({ enabled: false });
    expect(resolveQuizOption(false)).toEqual({ enabled: false });
  });

  it("enables quiz when flag is true", () => {
    expect(resolveQuizOption(true)).toEqual({ enabled: true });
  });

  it("fails closed for invalid --quiz values", () => {
    expect(() => resolveQuizOption("yes")).toThrow("Invalid --quiz value");
  });
});
