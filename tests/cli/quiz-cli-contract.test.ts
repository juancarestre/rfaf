import { describe, expect, it } from "bun:test";

function runCli(args: string[], env?: Record<string, string>) {
  const result = Bun.spawnSync(["bun", "src/cli/index.tsx", ...args], {
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

describe("quiz CLI contract", () => {
  it("fails with usage error for invalid negated --quiz form", () => {
    const result = runCli(["--no-quiz", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --quiz value");
  });

  it("uses validation-first semantics with --help and invalid quiz form", () => {
    const result = runCli(["--help", "--no-quiz"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --quiz value");
  });

  it("fails deterministically when --quiz is run without interactive terminal output", () => {
    const result = runCli(["--quiz", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Interactive terminal output is required for --quiz");
  });

  it("fails before file ingestion side effects for non-tty --quiz", () => {
    const result = runCli(["--quiz", "tests/fixtures/does-not-exist.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Interactive terminal output is required for --quiz");
    expect(result.stderr).not.toContain("File not found");
  });

  it("fails before URL fetch starts for non-tty --quiz", () => {
    const result = runCli(["--quiz", "https://example.com/article"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Interactive terminal output is required for --quiz");
    expect(result.stderr).not.toContain("fetching article");
  });
});
