import { describe, expect, it } from "bun:test";
import { resolveStrategyOption } from "../../src/cli/strategy-option";

describe("resolveStrategyOption", () => {
  it("disables strategy mode by default", () => {
    expect(resolveStrategyOption(undefined)).toEqual({ enabled: false });
    expect(resolveStrategyOption(false)).toEqual({ enabled: false });
    expect(resolveStrategyOption(null)).toEqual({ enabled: false });
  });

  it("enables strategy mode for bare boolean flag", () => {
    expect(resolveStrategyOption(true)).toEqual({ enabled: true });
  });

  it("uses the last parsed value when duplicate flags resolve to arrays", () => {
    expect(resolveStrategyOption([false, true])).toEqual({ enabled: true });
    expect(resolveStrategyOption([true, false])).toEqual({ enabled: false });
  });

  it("fails closed for non-boolean values", () => {
    expect(() => resolveStrategyOption("chunked")).toThrow("Invalid --strategy value");
  });
});
