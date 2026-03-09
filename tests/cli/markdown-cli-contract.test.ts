import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runCli(args: string[], env: Record<string, string> = {}) {
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

function runCliWithPipedStdin(
  input: string,
  args: string[],
  env: Record<string, string> = {}
) {
  const quotedInput = input.replace(/"/g, '\\"');
  const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "'\\''")}'`).join(" ");
  const command = `printf \"${quotedInput}\" | bun run src/cli/index.tsx ${quotedArgs}`;

  const result = Bun.spawnSync(["bash", "-lc", command], {
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

describe("markdown ingestion CLI contract", () => {
  it("returns deterministic error for markdown with no readable text", () => {
    const result = runCli(["tests/fixtures/empty.md"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Markdown has no readable text");
  });

  it("preserves file-over-stdin warning semantics for markdown paths", () => {
    const isolatedHome = mkdtempSync(join(tmpdir(), "rfaf-markdown-contract-"));
    const result = runCliWithPipedStdin(
      "ignored stdin",
      ["--summary=medium", "tests/fixtures/sample.md"],
      { HOME: isolatedHome }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Warning: file argument provided, ignoring stdin");
    expect(result.stderr).toContain("Config error");
  });

  it("keeps summary flag compatibility for markdown sources", () => {
    const isolatedHome = mkdtempSync(join(tmpdir(), "rfaf-markdown-summary-"));
    const result = runCli(
      ["--summary=medium", "tests/fixtures/sample.md"],
      { HOME: isolatedHome }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Config error");
  });
});
