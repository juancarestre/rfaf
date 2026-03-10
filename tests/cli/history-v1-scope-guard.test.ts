import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runCli(args: string[], env?: Record<string, string>): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const result = Bun.spawnSync(["bun", "run", "src/cli/index.tsx", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
      ...env,
    },
    stderr: "pipe",
    stdout: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: Buffer.from(result.stdout).toString("utf8"),
    stderr: Buffer.from(result.stderr).toString("utf8"),
  };
}

describe("history v1 scope guard", () => {
  it("does not render trend or rollup analytics fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-v1-"));
    const historyPath = join(dir, "history.json");

    writeFileSync(
      historyPath,
      JSON.stringify([
        {
          finishedAtMs: 1000,
          durationMs: 30_000,
          durationSeconds: 30,
          wordsRead: 100,
          averageWpm: 200,
          mode: "rsvp",
          sourceLabel: "source",
        },
      ])
    );

    const result = runCli(["history"], { RFAF_HISTORY_PATH: historyPath });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Date | Duration | Words | Avg WPM | Mode | Source");
    expect(result.stdout.includes("streak")).toBe(false);
    expect(result.stdout.includes("trend")).toBe(false);
    expect(result.stdout.includes("weekly")).toBe(false);
    expect(result.stdout.includes("total sessions")).toBe(false);
  });
});
