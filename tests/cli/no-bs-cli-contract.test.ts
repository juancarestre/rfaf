import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function runCli(
  args: string[],
  options: { env?: Record<string, string>; preloadPath?: string } = {}
) {
  const command = options.preloadPath
    ? ["bun", "--preload", options.preloadPath, "src/cli/index.tsx", ...args]
    : ["bun", "run", "src/cli/index.tsx", ...args];

  const result = Bun.spawnSync(command, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
      ...options.env,
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

describe("no-bs CLI contract", () => {
  it("fails with config usage error when --no-bs is enabled without config", () => {
    const result = runCli(["--no-bs", "tests/fixtures/sample.txt"], {
      env: {
        HOME: "/tmp/rfaf-no-bs-contract-test-no-config",
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
  });

  it("surfaces deterministic no-bs runtime failure on language mismatch", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-no-bs-language-contract-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });
    writeFileSync(
      join(rfafDir, "config.yaml"),
      [
        "llm:",
        "  provider: openai",
        "  model: gpt-4o-mini",
        "defaults:",
        "  timeout_ms: 5000",
        "  max_retries: 0",
      ].join("\n")
    );

    const result = runCli(["--no-bs", "tests/fixtures/sample-ja.txt"], {
      preloadPath: "./tests/fixtures/preload-no-bs-mock.ts",
      env: {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_NO_BS_MOCK_SCENARIO: "language-mismatch",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[error] no-bs failed");
    expect(result.stderr).toContain("No-BS failed [schema]");
    expect(result.stderr).toContain("language preservation check failed");
  });

  it("fails closed for valued --no-bs form", () => {
    const result = runCli(["--no-bs=wat", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --no-bs value");
  });

  it("fails closed for negated --no-no-bs form", () => {
    const result = runCli(["--no-no-bs", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --no-bs value");
  });
});
