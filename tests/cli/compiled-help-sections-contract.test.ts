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

function firstOptionIndex(helpText: string, flag: string): number {
  const pattern = new RegExp(`^\\s+${escapeRegExp(flag)}\\b`, "m");
  return helpText.search(pattern);
}

function assertFlagsInAiSection(helpText: string): void {
  const aiSectionStart = helpText.indexOf("AI Processing:");
  const optionsSectionStart = helpText.indexOf("Options:");

  expect(aiSectionStart).toBeGreaterThan(-1);
  expect(optionsSectionStart).toBeGreaterThan(aiSectionStart);

  for (const flag of AI_FLAGS) {
    expect(helpText).toContain(flag);
    expect(countOptionEntries(helpText, flag)).toBe(1);

    const optionIndex = firstOptionIndex(helpText, flag);
    expect(optionIndex).toBeGreaterThan(aiSectionStart);
    expect(optionIndex).toBeLessThan(optionsSectionStart);
  }
}

describe("compiled help sections contract", () => {
  it("keeps sectioned help semantics aligned with source run", () => {
    const source = runSourceCli(["--help"]);
    const compiled = runCompiledCli(["--help"]);

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toBe(source.stderr);
    expect(compiled.stdout).toContain("Reading & Input:");
    expect(compiled.stdout).toContain("AI Processing:");
    expect(source.stdout).toContain("Reading & Input:");
    expect(source.stdout).toContain("AI Processing:");

    assertFlagsInAiSection(compiled.stdout);
    assertFlagsInAiSection(source.stdout);
  });
});
