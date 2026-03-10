import { describe, expect, it } from "bun:test";
import { runCompiledCli, runSourceCli } from "./compiled-contract-helpers";

describe("compiled error exit contract", () => {
  it("matches source-run missing file failure contract", () => {
    const source = runSourceCli(["does-not-exist.txt"]);
    const compiled = runCompiledCli(["does-not-exist.txt"]);

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toContain("File not found");
    expect(compiled.stderr).toBe(source.stderr);
  });
});
