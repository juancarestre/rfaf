import { describe, expect, it } from "bun:test";
import { runCompiledPtySession } from "./compiled-pty-helpers";

const PTY_TEST_TIMEOUT_MS = 30_000;

describe("compiled runtime lifecycle PTY contract", () => {
  it("quits cleanly and restores terminal mode flags", () => {
    const result = runCompiledPtySession({ action: "quit", disableAltScreen: true });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Press Space to start");
    expect(result.canonicalModeRestored).toBe(true);
    expect(result.echoRestored).toBe(true);
  }, PTY_TEST_TIMEOUT_MS);

  it("enters and exits alternate screen when enabled", () => {
    const result = runCompiledPtySession({ action: "quit", disableAltScreen: false });

    expect(result.exitCode).toBe(0);
    expect(result.altScreenEntered).toBe(true);
    expect(result.altScreenExited).toBe(true);
    expect(result.canonicalModeRestored).toBe(true);
    expect(result.echoRestored).toBe(true);
  }, PTY_TEST_TIMEOUT_MS);
});
