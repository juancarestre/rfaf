import { describe, expect, it } from "bun:test";
import {
  ADAPTIVE_TIMEOUT_LARGE_INPUT_BYTES,
  ADAPTIVE_TIMEOUT_MEDIUM_INPUT_BYTES,
  resolveAdaptiveTimeoutMs,
} from "../../src/llm/timeout-policy";

describe("adaptive timeout budget tiers", () => {
  it("keeps base timeout for small input", () => {
    const timeout = resolveAdaptiveTimeoutMs(20_000, "a".repeat(ADAPTIVE_TIMEOUT_MEDIUM_INPUT_BYTES));
    expect(timeout).toBe(20_000);
  });

  it("uses medium tier above medium threshold", () => {
    const timeout = resolveAdaptiveTimeoutMs(
      20_000,
      "a".repeat(ADAPTIVE_TIMEOUT_MEDIUM_INPUT_BYTES + 1)
    );
    expect(timeout).toBe(40_000);
  });

  it("uses large tier above large threshold", () => {
    const timeout = resolveAdaptiveTimeoutMs(
      20_000,
      "a".repeat(ADAPTIVE_TIMEOUT_LARGE_INPUT_BYTES + 1)
    );
    expect(timeout).toBe(60_000);
  });
});
