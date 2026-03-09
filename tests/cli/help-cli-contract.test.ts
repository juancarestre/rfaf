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

describe("help CLI contract", () => {
  it("describes URL input and new reading workflow", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("rfaf [input] [options]");
    expect(result.stdout).toContain("Plaintext/PDF/EPUB/Markdown file path or article URL (http/https)");
    expect(result.stdout).toContain("--clipboard");
    expect(result.stdout).toContain("https://example.com/article");
    expect(result.stdout).toContain("rfaf --clipboard");
    expect(result.stdout).toContain("--summary=medium --mode");
    expect(result.stdout).toContain("Runtime controls:");
    expect(result.stdout).toContain("1-4 switch mod");
  });
});
