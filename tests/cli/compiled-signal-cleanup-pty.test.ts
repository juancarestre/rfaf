import { describe, expect, it } from "bun:test";
import { runCompiledPtySession } from "./compiled-pty-helpers";

describe("compiled signal cleanup PTY contract", () => {
  it("exits on SIGINT and restores terminal mode flags", () => {
    const result = runCompiledPtySession({ action: "sigint", disableAltScreen: false });

    expect([0, -2].includes(result.exitCode)).toBe(true);
    expect(result.canonicalModeRestored).toBe(true);
    expect(result.echoRestored).toBe(true);
  });
});
