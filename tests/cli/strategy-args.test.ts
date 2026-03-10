import { describe, expect, it } from "bun:test";
import {
  validateStrategyArgs,
  wasStrategyFlagProvided,
} from "../../src/cli/strategy-option";

describe("strategy raw argv contracts", () => {
  it("accepts bare --strategy forms", () => {
    expect(() => validateStrategyArgs(["--strategy", "tests/fixtures/sample.txt"])).not.toThrow();
    expect(() => validateStrategyArgs(["--strategy", "--strategy"])).not.toThrow();
  });

  it("fails closed for valued --strategy forms", () => {
    expect(() => validateStrategyArgs(["--strategy=chunked"])).toThrow(
      "Invalid --strategy value"
    );
  });

  it("fails closed for negated --strategy forms", () => {
    expect(() => validateStrategyArgs(["--no-strategy"])).toThrow(
      "Invalid --strategy value"
    );
    expect(() => validateStrategyArgs(["--no-strategy=true"])).toThrow(
      "Invalid --strategy value"
    );
  });

  it("detects whether strategy flag is present", () => {
    expect(wasStrategyFlagProvided(["--wpm=300", "sample.txt"])).toBe(false);
    expect(wasStrategyFlagProvided(["--strategy", "sample.txt"])).toBe(true);
    expect(wasStrategyFlagProvided(["--strategy=true", "sample.txt"])).toBe(true);
  });
});
