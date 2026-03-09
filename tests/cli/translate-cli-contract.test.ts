import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function runCli(args: string[], env?: Record<string, string>) {
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

describe("translate-to CLI contract", () => {
  it("fails with usage error when --translate-to is missing value", () => {
    const result = runCli(["--translate-to", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --translate-to value");
  });

  it("fails with config usage error when translation is enabled without config", () => {
    const result = runCli(["--translate-to=es", "tests/fixtures/sample.txt"], {
      HOME: "/tmp/rfaf-translate-contract-test-no-config",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
  });

  it("accepts space-separated --translate-to value form", () => {
    const result = runCli(["--translate-to", "es", "tests/fixtures/sample.txt"], {
      HOME: "/tmp/rfaf-translate-contract-test-space-value",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
    expect(result.stderr).not.toContain("Invalid --translate-to value");
  });

  it("accepts BCP-47 numeric subtags in space-separated form", () => {
    const result = runCli(["--translate-to", "es-419", "tests/fixtures/sample.txt"], {
      HOME: "/tmp/rfaf-translate-contract-test-space-bcp47",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
    expect(result.stderr).not.toContain("Invalid --translate-to value");
  });

  it("fails closed when --translate-to target is unresolved", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-translate-contract-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });
    writeFileSync(
      join(rfafDir, "config.toml"),
      [
        "[llm]",
        'provider = "openai"',
        'model = "gpt-4o-mini"',
        "",
        "[summary]",
        "timeout_ms = 5000",
        "max_retries = 0",
      ].join("\n")
    );

    const result = runCli(["--translate-to=zzzzzz", "tests/fixtures/sample.txt"], {
      HOME: homeDir,
      OPENAI_API_KEY: "dummy",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Unresolved --translate-to target");
  });
});
