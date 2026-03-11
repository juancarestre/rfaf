import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function runCli(args: string[], env?: Record<string, string>) {
  const result = Bun.spawnSync([
    "bun",
    "run",
    "src/cli/index.tsx",
    ...args,
  ], {
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

function runCliWithPreload(
  preloadPath: string,
  args: string[],
  env?: Record<string, string>
) {
  const result = Bun.spawnSync([
    "bun",
    "--preload",
    preloadPath,
    "src/cli/index.tsx",
    ...args,
  ], {
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

describe("summary CLI contract", () => {
  it("returns usage error for unsupported summary presets", () => {
    const result = runCli(["--summary=huge", "tests/fixtures/sample.txt"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --summary value");
  });

  it("uses validation-first semantics with --help and invalid summary", () => {
    const result = runCli(["--help", "--summary=huge"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --summary value");
  });

  it("fails closed for unknown token after --summary", () => {
    const result = runCli(["--summary", "missing-file.txt"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --summary value");
  });

  it("fails with config usage error when summarize mode is enabled without config", () => {
    const result = runCli([
      "--summary=medium",
      "tests/fixtures/sample.txt",
    ], {
      HOME: "/tmp/rfaf-summary-contract-test-no-config",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
  });

  it("fails closed on timeout in non-interactive mode by default", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-summary-contract-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });
    writeFileSync(
      join(rfafDir, "config.yaml"),
      [
        "llm:",
        "  provider: openai",
        "  model: gpt-4o-mini",
        "defaults:",
        "  timeout_ms: 1",
        "  max_retries: 0",
      ].join("\n")
    );

    const result = runCli(["--summary=medium", "tests/fixtures/sample.txt"], {
      HOME: homeDir,
      OPENAI_API_KEY: "dummy",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("summarizing (medium) with openai/gpt-4o-mini");
    expect(result.stderr).not.toContain("Summarizing:");
    expect(result.stderr).toContain("[error] summarization failed");
    expect(result.stderr).toContain("Summarization failed [timeout]");
    expect(result.stderr).not.toContain("continuing without summary transform");
  });

  it("allows explicit non-interactive timeout continue via env flag", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-summary-contract-continue-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });
    writeFileSync(
      join(rfafDir, "config.yaml"),
      [
        "llm:",
        "  provider: openai",
        "  model: gpt-4o-mini",
        "defaults:",
        "  timeout_ms: 1",
        "  max_retries: 0",
      ].join("\n")
    );

    const result = runCli(["--summary=medium", "tests/fixtures/sample.txt"], {
      HOME: homeDir,
      OPENAI_API_KEY: "dummy",
      RFAF_TIMEOUT_CONTINUE: "1",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("[warn] summary timed out; continuing without summary transform");
    expect(result.stderr).not.toContain("[error] summarization failed");
  });

  it("surfaces deterministic language-preservation failure for translated summary output", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-summary-language-contract-"));
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

    const result = runCliWithPreload(
      "./tests/fixtures/preload-summary-mock.ts",
      ["--summary=medium", "tests/fixtures/sample-es.txt"],
      {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_SUMMARY_MOCK_SCENARIO: "language-mismatch",
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[error] summarization failed");
    expect(result.stderr).toContain("language preservation check failed");
  });

  it("fails closed when summary violates proportional preset bounds", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-summary-length-contract-"));
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

    const result = runCliWithPreload(
      "./tests/fixtures/preload-summary-mock.ts",
      ["--summary=short", "tests/fixtures/ozzy.txt"],
      {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_SUMMARY_MOCK_SCENARIO: "length-mismatch",
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[error] summarization failed");
    expect(result.stderr).toContain("summary length check failed");
  });

  it("automatically chunks long summary input and succeeds without new flags", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-summary-long-input-contract-"));
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

    const longInputPath = join(homeDir, "long-summary-input.txt");
    writeFileSync(
      longInputPath,
      "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(450)
    );

    const result = runCliWithPreload(
      "./tests/fixtures/preload-summary-mock.ts",
      ["--summary=long", longInputPath],
      {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_SUMMARY_MOCK_SCENARIO: "long-input-chunk-required",
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("summarizing (long)");
    expect(result.stderr).not.toContain("[error] summarization failed");
  });
});
