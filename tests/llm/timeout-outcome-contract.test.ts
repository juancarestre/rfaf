import { describe, expect, it } from "bun:test";
import { resolveTimeoutRecoveryOutcome } from "../../src/cli/timeout-recovery";

describe("timeout outcome contract", () => {
  it("defaults to abort in non-interactive mode", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: false,
      transformLabel: "summary",
    });

    expect(result).toBe("abort");
  });

  it("allows explicit continue in non-interactive mode", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: false,
      transformLabel: "summary",
      allowNonInteractiveContinue: true,
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

  it("aborts when interactive prompt times out", async () => {
    const result = await resolveTimeoutRecoveryOutcome({
      isInteractive: true,
      transformLabel: "summary",
      ask: async () => new Promise<string>(() => {}),
      promptTimeoutMs: 5,
    });

    expect(result).toBe("abort");
  });
});
