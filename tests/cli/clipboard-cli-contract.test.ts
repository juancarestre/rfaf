import { describe, expect, it } from "bun:test";

function runCli(args: string[], scenario = "success") {
  const result = Bun.spawnSync(
    [
      "bun",
      "--preload",
      "./tests/fixtures/preload-clipboard-mock.ts",
      "src/cli/index.tsx",
      ...args,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RFAF_NO_ALT_SCREEN: "1",
        RFAF_CLIPBOARD_MOCK_SCENARIO: scenario,
      },
      stderr: "pipe",
      stdout: "pipe",
    }
  );

  return {
    exitCode: result.exitCode,
    stdout: Buffer.from(result.stdout).toString("utf8"),
    stderr: Buffer.from(result.stderr).toString("utf8"),
  };
}

function runCliWithPipedStdin(input: string, args: string[], scenario = "success") {
  const quotedInput = input.replace(/"/g, '\\"');
  const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "'\\''")}'`).join(" ");
  const command =
    `printf \"${quotedInput}\" | ` +
    `bun --preload ./tests/fixtures/preload-clipboard-mock.ts src/cli/index.tsx ${quotedArgs}`;

  const result = Bun.spawnSync(["bash", "-lc", command], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
      RFAF_CLIPBOARD_MOCK_SCENARIO: scenario,
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

describe("clipboard CLI contract", () => {
  it("fails fast when --clipboard is combined with file input", () => {
    const result = runCli(["--clipboard", "--", "tests/fixtures/sample.md"], "guard");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Cannot combine --clipboard with file input");
    expect(result.stderr).not.toContain("CLIPBOARD_READ_SHOULD_NOT_BE_CALLED");
  });

  it("fails fast when --clipboard is combined with URL input", () => {
    const result = runCli(["--clipboard", "https://example.com/article"], "guard");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Cannot combine --clipboard with URL input");
    expect(result.stderr).not.toContain("CLIPBOARD_READ_SHOULD_NOT_BE_CALLED");
  });

  it("fails fast when --clipboard is combined with piped stdin", () => {
    const result = runCliWithPipedStdin("hello", ["--clipboard"], "guard");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Cannot combine --clipboard with piped stdin");
    expect(result.stderr).not.toContain("CLIPBOARD_READ_SHOULD_NOT_BE_CALLED");
  });

  it("returns deterministic runtime failure for unavailable clipboard backend", () => {
    const result = runCli(["--clipboard"], "unavailable");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Clipboard is unavailable on this system");
  });
});
