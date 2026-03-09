import { describe, expect, it } from "bun:test";
import { resolveNoBsOption } from "../../src/cli/no-bs-option";

describe("resolveNoBsOption", () => {
  it("disables no-bs when flag is absent or false", () => {
    expect(resolveNoBsOption(undefined)).toEqual({ enabled: false });
    expect(resolveNoBsOption(false)).toEqual({ enabled: false });
  });

  it("enables no-bs when flag is true", () => {
    expect(resolveNoBsOption(true)).toEqual({ enabled: true });
  });

  it("fails closed for invalid no-bs values", () => {
    expect(() => resolveNoBsOption("yes")).toThrow("Invalid --no-bs value");
  });
});
