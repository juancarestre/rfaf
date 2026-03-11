/// <reference types="bun-types" />

import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

interface CompileManifest {
  artifacts: Array<{ file: string }>;
}

export interface PackageOptions {
  binDir: string;
  outDir: string;
  installScriptPath: string;
  cwd: string;
}

function resolvePathFromCwd(cwd: string, pathLike: string): string {
  return isAbsolute(pathLike) ? pathLike : resolve(cwd, pathLike);
}

function loadExpectedArtifacts(binDir: string): string[] {
  const manifestPath = join(binDir, "compile-manifest.json");
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as CompileManifest;

  if (!Array.isArray(parsed.artifacts) || parsed.artifacts.length === 0) {
    throw new Error("compile-manifest.json must include at least one artifact.");
  }

  return parsed.artifacts.map((artifact) => basename(artifact.file)).sort((a, b) => a.localeCompare(b));
}

export function resolvePackagedExecutableName(artifactFile: string): string {
  return artifactFile.endsWith(".exe") ? "rfaf.exe" : "rfaf";
}

export function resolveArchiveName(artifactFile: string): string {
  return `${artifactFile}.tar.gz`;
}

function runTarCreate(archivePath: string, stageDir: string, executableName: string, cwd: string): void {
  const result = Bun.spawnSync(["tar", "-czf", archivePath, "-C", stageDir, executableName], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = Buffer.from(result.stderr).toString("utf8");
    throw new Error(`Failed to create archive ${archivePath}:\n${stderr}`);
  }
}

function copyIfExists(sourcePath: string, targetPath: string): void {
  if (existsSync(sourcePath)) {
    copyFileSync(sourcePath, targetPath);
  }
}

export function packageReleaseArtifacts(options: PackageOptions): string[] {
  const binDir = resolvePathFromCwd(options.cwd, options.binDir);
  const outDir = resolvePathFromCwd(options.cwd, options.outDir);
  const installScriptPath = resolvePathFromCwd(options.cwd, options.installScriptPath);
  const expectedArtifacts = loadExpectedArtifacts(binDir);
  const stagingRoot = join(outDir, ".staging");

  if (!existsSync(installScriptPath)) {
    throw new Error(`Install script not found: ${installScriptPath}`);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });

  const packagedFiles: string[] = [];

  for (const artifact of expectedArtifacts) {
    const sourcePath = join(binDir, artifact);
    const sourceStats = lstatSync(sourcePath);

    if (sourceStats.isSymbolicLink()) {
      throw new Error(`Cannot package symlink artifact: ${artifact}`);
    }

    if (!sourceStats.isFile()) {
      throw new Error(`Cannot package missing artifact file: ${artifact}`);
    }

    const stageDir = join(stagingRoot, artifact);
    const executableName = resolvePackagedExecutableName(artifact);
    const stagedExecutablePath = join(stageDir, executableName);

    mkdirSync(stageDir, { recursive: true });
    copyFileSync(sourcePath, stagedExecutablePath);
    chmodSync(stagedExecutablePath, sourceStats.mode);

    const archiveName = resolveArchiveName(artifact);
    const archivePath = join(outDir, archiveName);
    runTarCreate(archivePath, stageDir, executableName, options.cwd);
    packagedFiles.push(archiveName);
  }

  const installOutPath = join(outDir, "install.sh");
  copyFileSync(installScriptPath, installOutPath);
  chmodSync(installOutPath, 0o755);
  packagedFiles.push("install.sh");

  copyIfExists(join(binDir, "SHA256SUMS"), join(outDir, "SHA256SUMS"));
  copyIfExists(join(binDir, "release-manifest.json"), join(outDir, "release-manifest.json"));
  copyIfExists(join(binDir, "compile-manifest.json"), join(outDir, "compile-manifest.json"));

  if (existsSync(join(outDir, "SHA256SUMS"))) {
    packagedFiles.push("SHA256SUMS");
  }

  if (existsSync(join(outDir, "release-manifest.json"))) {
    packagedFiles.push("release-manifest.json");
  }

  if (existsSync(join(outDir, "compile-manifest.json"))) {
    packagedFiles.push("compile-manifest.json");
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  writeFileSync(join(outDir, "packaged-files.json"), JSON.stringify(packagedFiles.sort(), null, 2));

  return packagedFiles.sort();
}

function parseArgs(args: string[]): { binDir: string; outDir: string; installScriptPath: string } {
  const binDirFlagIndex = args.indexOf("--bin-dir");
  const outDirFlagIndex = args.indexOf("--out-dir");
  const installScriptFlagIndex = args.indexOf("--install-script");

  return {
    binDir: binDirFlagIndex >= 0 && args[binDirFlagIndex + 1] ? args[binDirFlagIndex + 1] : "dist/bin",
    outDir: outDirFlagIndex >= 0 && args[outDirFlagIndex + 1] ? args[outDirFlagIndex + 1] : "dist/release",
    installScriptPath:
      installScriptFlagIndex >= 0 && args[installScriptFlagIndex + 1]
        ? args[installScriptFlagIndex + 1]
        : "install.sh",
  };
}

export function runPackageCli(args: string[]): void {
  const parsed = parseArgs(args);
  const packaged = packageReleaseArtifacts({
    binDir: parsed.binDir,
    outDir: parsed.outDir,
    installScriptPath: parsed.installScriptPath,
    cwd: process.cwd(),
  });

  process.stdout.write(`Packaged ${packaged.length} release file(s) into ${parsed.outDir}\n`);
}

if (import.meta.main) {
  runPackageCli(process.argv.slice(2));
}
