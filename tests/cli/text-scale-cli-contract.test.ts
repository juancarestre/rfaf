import { describe, expect, it } from "bun:test";

function runCli(args: string[]) {
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

describe("text-scale CLI contract", () => {
  it("returns usage error for unsupported preset values", () => {
    const result = runCli(["--text-scale", "huge"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --text-scale value");
  });

  it("returns usage error when --text-scale is missing a value", () => {
    const result = runCli(["--text-scale"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("text-scale");
  });

  it("uses validation-first semantics when --help is combined with invalid text-scale", () => {
    const result = runCli(["--help", "--text-scale", "huge"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --text-scale value");
  });

  it("uses validation-first semantics when --version is combined with invalid text-scale", () => {
    const result = runCli(["--version", "--text-scale", "huge"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid --text-scale value");
  });

  it("uses last value when duplicate text-scale flags are provided", () => {
    const result = runCli(["--text-scale", "small", "--text-scale", "large"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Invalid --text-scale value");
  });

  it("prints help exactly once without stderr noise", () => {
    const result = runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.match(/rfaf \[input\] \[options\]/g)?.length ?? 0).toBe(1);
  });

  it("prints version without additional help output", () => {
    const result = runCli(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe("0.1.0");
  });
});
