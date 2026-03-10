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

describe("strategy CLI contract", () => {
  it("fails closed for valued --strategy form", () => {
    const result = runCli(["--strategy=chunked", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --strategy value");
  });

  it("uses validation-first semantics with --help and invalid strategy value", () => {
    const result = runCli(["--help", "--strategy=chunked"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --strategy value");
  });

  it("warns and continues when strategy cannot load config", () => {
    const result = runCli(["--strategy", "--summary=short", "tests/fixtures/sample.txt"], {
      env: {
        HOME: "/tmp/rfaf-strategy-contract-test-no-config",
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("[warn] Strategy unavailable [config]");
    expect(result.stderr).toContain("Config error");
  });

  it("fails closed for negated --no-strategy form", () => {
    const result = runCli(["--no-strategy", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --strategy value");
  });

  it("reports would-have-picked strategy when explicit --mode is provided", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-strategy-mode-contract-"));
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

    const result = runCli(
      ["--strategy", "--mode=scroll", "--summary=short", "tests/fixtures/sample-es.txt"],
      {
        preloadPath: "./tests/fixtures/preload-strategy-summary-mock.ts",
        env: {
          HOME: homeDir,
          OPENAI_API_KEY: "dummy",
        },
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[ok] strategy would pick chunked");
    expect(result.stderr).toContain("keeping --mode=scroll");
    expect(result.stderr).toContain("[error] summarization failed");
  });

  it("starts in recommended mode when --mode is not explicitly provided", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-strategy-default-mode-contract-"));
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

    const result = runCli(["--strategy", "--summary=short", "tests/fixtures/sample-es.txt"], {
      preloadPath: "./tests/fixtures/preload-strategy-summary-mock.ts",
      env: {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[ok] strategy recommends chunked");
    expect(result.stderr).toContain("starting mode=chunked");
    expect(result.stderr).toContain("[error] summarization failed");
  });
});
