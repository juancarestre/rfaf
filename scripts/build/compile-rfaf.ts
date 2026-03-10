/// <reference types="bun-types" />

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_ENTRYPOINT = "src/cli/index.tsx";
export const DEFAULT_OUT_DIR = "dist/bin";

export const COMPILE_TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64-baseline",
  "bun-windows-x64-baseline",
] as const;

export type CompileTarget = (typeof COMPILE_TARGETS)[number];

export interface CompilePlan {
  target: CompileTarget;
  outfile: string;
  args: string[];
}

export interface CompileOptions {
  version: string;
  outDir: string;
  currentOnly: boolean;
  cwd: string;
}

function normalizeVersion(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Version is required to build distribution artifacts.");
  }

  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function artifactFileName(version: string, target: CompileTarget): string {
  const safeVersion = normalizeVersion(version);
  const extension = target.includes("windows") ? ".exe" : "";
  return `rfaf-${safeVersion}-${target}${extension}`;
}

export function resolveCurrentTarget(
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture
): CompileTarget {
  if (platform === "darwin") {
    return arch === "arm64" ? "bun-darwin-arm64" : "bun-darwin-x64";
  }

  if (platform === "linux") {
    return arch === "arm64" ? "bun-linux-arm64" : "bun-linux-x64-baseline";
  }

  if (platform === "win32") {
    return "bun-windows-x64-baseline";
  }

  throw new Error(`Unsupported platform for compile target resolution: ${platform}`);
}

export function resolveCompileTargets(currentOnly: boolean): CompileTarget[] {
  if (currentOnly) {
    return [resolveCurrentTarget(process.platform, process.arch)];
  }

  return [...COMPILE_TARGETS];
}

export function buildCompileArgs(entrypoint: string, target: CompileTarget, outfile: string): string[] {
  return [
    "build",
    entrypoint,
    "--compile",
    "--minify",
    "--sourcemap",
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
    `--target=${target}`,
    "--outfile",
    outfile,
  ];
}

export function createCompilePlan(options: CompileOptions): CompilePlan[] {
  return resolveCompileTargets(options.currentOnly).map((target) => {
    const outfile = join(options.outDir, artifactFileName(options.version, target));
    return {
      target,
      outfile,
      args: buildCompileArgs(DEFAULT_ENTRYPOINT, target, outfile),
    };
  });
}

export function compileArtifacts(options: CompileOptions): CompilePlan[] {
  const plan = createCompilePlan(options);
  mkdirSync(options.outDir, { recursive: true });

  for (const build of plan) {
    const result = Bun.spawnSync(["bun", ...build.args], {
      cwd: options.cwd,
      stderr: "pipe",
      stdout: "pipe",
    });

    if (result.exitCode !== 0) {
      const stderr = Buffer.from(result.stderr).toString("utf8");
      throw new Error(`Compile failed for ${build.target}:\n${stderr}`);
    }
  }

  const manifestPath = join(options.outDir, "compile-manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: normalizeVersion(options.version),
        generatedAt: new Date().toISOString(),
        artifacts: plan.map((item) => ({
          target: item.target,
          file: item.outfile,
        })),
      },
      null,
      2
    )
  );

  return plan;
}

function parseArgs(args: string[], packageVersion: string): CompileOptions {
  const hasCurrentOnly = args.includes("--current");
  const outDirFlagIndex = args.indexOf("--out-dir");
  const outDir =
    outDirFlagIndex >= 0 && args[outDirFlagIndex + 1]
      ? args[outDirFlagIndex + 1]
      : DEFAULT_OUT_DIR;

  return {
    version: normalizeVersion(packageVersion),
    outDir,
    currentOnly: hasCurrentOnly,
    cwd: process.cwd(),
  };
}

export function runCompileCli(args: string[]): void {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const options = parseArgs(args, packageJson.version);
  const plan = compileArtifacts(options);

  process.stdout.write(`Compiled ${plan.length} artifact(s) into ${options.outDir}\n`);
}

if (import.meta.main) {
  runCompileCli(process.argv.slice(2));
}
