import { describe, expect, it } from "bun:test";
import { runCompiledCli, runSourceCli } from "./compiled-contract-helpers";

describe("compiled help contract", () => {
  it("matches source-run help semantics", () => {
    const source = runSourceCli(["--help"]);
    const compiled = runCompiledCli(["--help"]);

    expect(compiled.exitCode).toBe(source.exitCode);
    expect(compiled.stderr).toBe(source.stderr);
    expect(compiled.stdout).toContain("rfaf [input] [options]");
    expect(compiled.stdout).toContain("Plaintext/PDF/EPUB/Markdown file path or article URL (http/https)");
    expect(compiled.stdout).toContain("rfaf history");
    expect(compiled.stdout).toContain("Runtime controls:");
  });
});
