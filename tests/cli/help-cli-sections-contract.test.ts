import { describe, expect, it } from "bun:test";

const AI_FLAGS = [
  "--summary",
  "--no-bs",
  "--translate-to",
  "--key-phrases",
  "--quiz",
  "--strategy",
] as const;

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOptionEntries(helpText: string, flag: string): number {
  const pattern = new RegExp(`^\\s+${escapeRegExp(flag)}\\b`, "gm");
  return helpText.match(pattern)?.length ?? 0;
}

function firstOptionIndex(helpText: string, flag: string): number {
  const pattern = new RegExp(`^\\s+${escapeRegExp(flag)}\\b`, "m");
  return helpText.search(pattern);
}

describe("help CLI sections contract", () => {
  it("groups help output into clear sections with AI Processing flags", () => {
    const result = runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Reading & Input:");
    expect(result.stdout).toContain("AI Processing:");

    const aiSectionStart = result.stdout.indexOf("AI Processing:");
    const optionsSectionStart = result.stdout.indexOf("Options:");
    expect(aiSectionStart).toBeGreaterThan(-1);
    expect(optionsSectionStart).toBeGreaterThan(aiSectionStart);

    for (const flag of AI_FLAGS) {
      expect(result.stdout).toContain(flag);
      expect(countOptionEntries(result.stdout, flag)).toBe(1);

      const optionIndex = firstOptionIndex(result.stdout, flag);
      expect(optionIndex).toBeGreaterThan(aiSectionStart);
      expect(optionIndex).toBeLessThan(optionsSectionStart);
    }
  });
});
