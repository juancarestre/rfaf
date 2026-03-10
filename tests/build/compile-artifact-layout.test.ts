import { describe, expect, it } from "bun:test";
import {
  artifactFileName,
  buildCompileArgs,
  COMPILE_TARGETS,
  createCompilePlan,
  resolveCurrentTarget,
} from "../../scripts/build/compile-rfaf";

describe("compile artifact layout", () => {
  it("defines deterministic supported target matrix", () => {
    expect(COMPILE_TARGETS).toEqual([
      "bun-darwin-arm64",
      "bun-darwin-x64",
      "bun-linux-arm64",
      "bun-linux-x64-baseline",
      "bun-windows-x64-baseline",
    ]);
  });

  it("uses deterministic artifact file naming per target", () => {
    expect(artifactFileName("0.1.0", "bun-darwin-arm64")).toBe(
      "rfaf-v0.1.0-bun-darwin-arm64"
    );
    expect(artifactFileName("v0.1.0", "bun-linux-x64-baseline")).toBe(
      "rfaf-v0.1.0-bun-linux-x64-baseline"
    );
    expect(artifactFileName("0.1.0", "bun-windows-x64-baseline")).toBe(
      "rfaf-v0.1.0-bun-windows-x64-baseline.exe"
    );
  });

  it("includes deterministic compile flags in build args", () => {
    const args = buildCompileArgs("src/cli/index.tsx", "bun-darwin-arm64", "dist/bin/rfaf");

    expect(args).toContain("--compile");
    expect(args).toContain("--minify");
    expect(args).toContain("--sourcemap");
    expect(args).toContain("--no-compile-autoload-dotenv");
    expect(args).toContain("--no-compile-autoload-bunfig");
    expect(args).toContain("--target=bun-darwin-arm64");
  });

  it("builds one plan entry per requested target", () => {
    const plan = createCompilePlan({
      version: "0.1.0",
      outDir: "dist/bin",
      currentOnly: false,
      cwd: process.cwd(),
    });

    expect(plan).toHaveLength(COMPILE_TARGETS.length);
    expect(plan[0]?.outfile).toContain("rfaf-v0.1.0-");
  });

  it("resolves current target for supported platform and architecture", () => {
    expect(resolveCurrentTarget("darwin", "arm64")).toBe("bun-darwin-arm64");
    expect(resolveCurrentTarget("darwin", "x64")).toBe("bun-darwin-x64");
    expect(resolveCurrentTarget("linux", "arm64")).toBe("bun-linux-arm64");
    expect(resolveCurrentTarget("linux", "x64")).toBe("bun-linux-x64-baseline");
    expect(resolveCurrentTarget("win32", "x64")).toBe("bun-windows-x64-baseline");
  });

  it("fails fast for unsupported architectures", () => {
    expect(() => resolveCurrentTarget("darwin", "ia32" as NodeJS.Architecture)).toThrow(
      "Unsupported architecture for macOS target resolution"
    );
    expect(() => resolveCurrentTarget("linux", "arm" as NodeJS.Architecture)).toThrow(
      "Unsupported architecture for Linux target resolution"
    );
    expect(() => resolveCurrentTarget("win32", "arm64" as NodeJS.Architecture)).toThrow(
      "Unsupported architecture for Windows target resolution"
    );
  });
});
