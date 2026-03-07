import { describe, expect, it } from "bun:test";

function runCli(args: string[], scenario: string) {
  const result = Bun.spawnSync(
    [
      "bun",
      "--preload",
      "./tests/fixtures/preload-url-mock.ts",
      "src/cli/index.tsx",
      ...args,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RFAF_NO_ALT_SCREEN: "1",
        RFAF_URL_MOCK_SCENARIO: scenario,
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

describe("url ingestion CLI contract", () => {
  it("exits 1 when url fetch fails", () => {
    const result = runCli(["https://example.com/article"], "fetch-error");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[error] failed to fetch article");
    expect(result.stderr).toContain("network down");
  });

  it("exits 1 when url extraction fails", () => {
    const result = runCli(["https://example.com/article"], "extraction-error");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[error] failed to fetch article");
    expect(result.stderr).toContain(
      "Could not extract article content from https://example.com/article"
    );
  });
});
