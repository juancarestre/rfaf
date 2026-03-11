import { describe, expect, it } from "bun:test";
import {
  createTimeoutDeadline,
  resolveRemainingTimeoutMs,
} from "../../src/llm/timeout-policy";

describe("timeout policy contract", () => {
  it("creates deadline using provided now timestamp", () => {
    expect(createTimeoutDeadline(5_000, 10_000)).toBe(15_000);
  });

  it("returns remaining time when deadline is in the future", () => {
    expect(resolveRemainingTimeoutMs(15_000, 12_250)).toBe(2_750);
  });

  it("returns zero when deadline is already exhausted", () => {
    expect(resolveRemainingTimeoutMs(10_000, 10_001)).toBe(0);
  });
});
