import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runCli(args: string[], env?: Record<string, string>, cwd?: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const cliPath = join(process.cwd(), "src/cli/index.tsx");
  const result = Bun.spawnSync(["bun", "run", cliPath, ...args], {
    cwd: cwd ?? process.cwd(),
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

describe("history CLI contract", () => {
  it("shows deterministic empty state", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-empty-"));
    const historyPath = join(dir, "history.json");

    const result = runCli(["history"], { RFAF_HISTORY_PATH: historyPath });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("No completed sessions yet.");
  });

  it("renders deterministic columns and newest-first order", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-list-"));
    const historyPath = join(dir, "history.json");
    mkdirSync(dir, { recursive: true });
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
          sourceLabel: "older",
        },
        {
          finishedAtMs: 2000,
          durationMs: 40_000,
          durationSeconds: 40,
          wordsRead: 140,
          averageWpm: 210,
          mode: "chunked",
          sourceLabel: "newer",
        },
      ])
    );

    const result = runCli(["history"], { RFAF_HISTORY_PATH: historyPath });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Date | Duration | Words | Avg WPM | Mode | Source");

    const lines = result.stdout.trim().split(/\r?\n/);
    expect(lines[1]?.endsWith("| chunked | newer")).toBe(true);
    expect(lines[2]?.endsWith("| rsvp | older")).toBe(true);
  });

  it("treats malformed storage as empty state", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-bad-"));
    const historyPath = join(dir, "history.json");
    writeFileSync(historyPath, "not-json");

    const result = runCli(["history"], { RFAF_HISTORY_PATH: historyPath });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("No completed sessions yet.");
  });

  it("reserves exact single-token history invocation for the command", () => {
    const result = runCli(["history", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("rfaf [input] [options]");
    expect(result.stdout).not.toContain("Date | Duration | Words | Avg WPM | Mode | Source");
  });

  it("still allows a literal file named history with additional args", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-file-"));
    writeFileSync(join(dir, "history"), "hello world");

    const result = runCli(["history", "--mode=rsvp"], undefined, dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Date | Duration | Words | Avg WPM | Mode | Source");
    expect(result.stdout).not.toContain("No completed sessions yet.");
  });
});
