import { describe, expect, it } from "bun:test";
import { runCompiledCli, runSourceCli } from "./compiled-contract-helpers";

const AI_FLAGS = [
  "--summary",
  "--no-bs",
  "--translate-to",
  "--key-phrases",
  "--quiz",
  "--strategy",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOptionEntries(helpText: string, flag: string): number {
  const pattern = new RegExp(`^\\s+${escapeRegExp(flag)}\\b`, "gm");
  return helpText.match(pattern)?.length ?? 0;
}

describe("compiled help sections contract", () => {
  it("keeps sectioned help semantics aligned with source run", () => {
    const source = runSourceCli(["--help"]);
    const compiled = runCompiledCli(["--help"]);

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toBe(source.stderr);
    expect(compiled.stdout).toContain("Reading & Input:");
    expect(compiled.stdout).toContain("AI Processing:");

    for (const flag of AI_FLAGS) {
      expect(compiled.stdout).toContain(flag);
      expect(countOptionEntries(compiled.stdout, flag)).toBe(1);
      expect(countOptionEntries(source.stdout, flag)).toBe(1);
    }
  });
});
