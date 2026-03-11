import { describe, expect, it } from "bun:test";
import { resolveTimeoutRecoveryOutcome } from "../../src/cli/timeout-recovery";

describe("timeout outcome contract", () => {
  it("defaults to continue without transform in non-interactive mode", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: false,
      transformLabel: "summary",
    });

    expect(result).toBe("continue");
  });

  it("continues when interactive user confirms", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: true,
      transformLabel: "summary",
      ask: async () => "y",
    });

    expect(result).toBe("continue");
  });

  it("aborts when interactive user declines", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: true,
      transformLabel: "summary",
      ask: async () => "n",
    });

    expect(result).toBe("abort");
  });
});
