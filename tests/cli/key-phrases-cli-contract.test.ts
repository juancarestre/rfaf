import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { unlinkSync } from "node:fs";
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

describe("key-phrases CLI contract", () => {
  it("fails closed for unsupported --key-phrases value", () => {
    const result = runCli(["--key-phrases=deep", "tests/fixtures/sample.txt"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --key-phrases value");
  });

  it("accepts space-separated bare form and fails with config usage error when unconfigured", () => {
    const result = runCli(["--key-phrases", "tests/fixtures/sample.txt"], {
      env: {
        HOME: "/tmp/rfaf-key-phrases-contract-test-no-config",
      },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
    expect(result.stderr).not.toContain("Invalid --key-phrases value");
  });

  it("treats extensionless positional token after --key-phrases as input path", () => {
    const fixtureName = "rfaf-keyphrases-notes";
    const fixturePath = join(process.cwd(), fixtureName);
    writeFileSync(fixturePath, "Speed reading improves comprehension.");

    try {
      const result = runCli(["--key-phrases", fixtureName], {
        env: {
          HOME: "/tmp/rfaf-key-phrases-contract-test-extensionless",
        },
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Config error");
      expect(result.stderr).not.toContain("Invalid --key-phrases value");
    } finally {
      unlinkSync(fixturePath);
    }
  });

  it("prints deterministic standalone list output in list mode", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-key-phrases-contract-"));
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

    const result = runCli(["--key-phrases=list", "tests/fixtures/sample.txt"], {
      preloadPath: "./tests/fixtures/preload-key-phrases-mock.ts",
      env: {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Key phrases (5):");
    expect(result.stdout).toContain("- speed reading");
    expect(result.stdout).toContain("- visual span");
  });

  it("sanitizes ANSI/control sequences in standalone list output", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-key-phrases-contract-ansi-"));
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

    const result = runCli(["--key-phrases=list", "tests/fixtures/sample.txt"], {
      preloadPath: "./tests/fixtures/preload-key-phrases-mock.ts",
      env: {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_KEY_PHRASES_MOCK_SCENARIO: "ansi",
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("- visual span");
    expect(result.stdout).not.toContain("\u0007");
  });

  it("fails closed with runtime exit semantics when extraction is empty", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-key-phrases-contract-empty-"));
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

    const result = runCli(["--key-phrases=list", "tests/fixtures/sample.txt"], {
      preloadPath: "./tests/fixtures/preload-key-phrases-mock.ts",
      env: {
        HOME: homeDir,
        OPENAI_API_KEY: "dummy",
        RFAF_KEY_PHRASES_MOCK_SCENARIO: "empty",
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("key-phrases failed");
    expect(result.stderr).toContain("[schema]");
  });
});
