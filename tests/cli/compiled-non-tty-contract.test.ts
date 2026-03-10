import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCompiledCli, runSourceCli } from "./compiled-contract-helpers";

describe("compiled non-tty contract", () => {
  it("preserves source-run version output in non-interactive mode", () => {
    const source = runSourceCli(["--version"]);
    const compiled = runCompiledCli(["--version"]);

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toBe(source.stderr);
    expect(compiled.stdout).toBe(source.stdout);
  });

  it("preserves source-run behavior for history command in non-interactive mode", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-compiled-history-"));
    const historyPath = join(dir, "history.json");

    const source = runSourceCli(["history"], { RFAF_HISTORY_PATH: historyPath });
    const compiled = runCompiledCli(["history"], { RFAF_HISTORY_PATH: historyPath });

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toBe(source.stderr);
    expect(compiled.stdout).toBe(source.stdout);
  });
});
