import { describe, expect, it } from "bun:test";

function runCli(args: string[]) {
  const result = Bun.spawnSync(["bun", "run", "src/cli/index.tsx", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
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

describe("reading mode CLI contract", () => {
  it("returns usage error for unsupported mode values", () => {
    const result = runCli(["--mode", "warp", "tests/fixtures/sample.txt"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --mode value");
  });

  it("accepts chunked mode when validating args", () => {
    const result = runCli(["--help", "--mode=chunked"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--mode");
  });

  it("accepts bionic mode when validating args", () => {
    const result = runCli(["--help", "--mode=bionic"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--mode");
  });
});
