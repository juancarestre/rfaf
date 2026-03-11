import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packageReleaseArtifacts,
  resolveArchiveName,
  resolvePackagedExecutableName,
} from "../../scripts/release/package-artifacts";

function writeCompileManifest(binDir: string, files: string[]): void {
  writeFileSync(
    join(binDir, "compile-manifest.json"),
    JSON.stringify(
      {
        artifacts: files.map((file) => ({ file: join(binDir, file) })),
      },
      null,
      2
    )
  );
}

function listArchiveEntries(archivePath: string): string[] {
  const result = Bun.spawnSync(["tar", "-tzf", archivePath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  return Buffer.from(result.stdout)
    .toString("utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
}

describe("release package artifacts", () => {
  it("packages compiled binaries as target archives and copies metadata", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "rfaf-package-release-"));
    const binDir = join(rootDir, "dist", "bin");
    const outDir = join(rootDir, "dist", "release");
    const installScriptPath = join(rootDir, "install.sh");
    mkdirSync(binDir, { recursive: true });
    const darwinArtifact = "rfaf-v0.1.0-bun-darwin-arm64";
    const windowsArtifact = "rfaf-v0.1.0-bun-windows-x64-baseline.exe";

    writeFileSync(join(binDir, darwinArtifact), "darwin-binary");
    writeFileSync(join(binDir, windowsArtifact), "windows-binary");
    writeCompileManifest(binDir, [darwinArtifact, windowsArtifact]);
    writeFileSync(join(binDir, "SHA256SUMS"), "abc  rfaf-v0.1.0-bun-darwin-arm64\n");
    writeFileSync(join(binDir, "release-manifest.json"), "{}\n");
    writeFileSync(installScriptPath, "#!/usr/bin/env sh\n");

    const packaged = packageReleaseArtifacts({
      binDir,
      outDir,
      installScriptPath,
      cwd: process.cwd(),
    });

    expect(packaged).toContain(resolveArchiveName(darwinArtifact));
    expect(packaged).toContain(resolveArchiveName(windowsArtifact));
    expect(packaged).toContain("install.sh");
    expect(packaged).toContain("SHA256SUMS");
    expect(packaged).toContain("release-manifest.json");
    expect(packaged).toContain("compile-manifest.json");

    const darwinEntries = listArchiveEntries(join(outDir, resolveArchiveName(darwinArtifact)));
    const windowsEntries = listArchiveEntries(join(outDir, resolveArchiveName(windowsArtifact)));

    expect(darwinEntries).toEqual([resolvePackagedExecutableName(darwinArtifact)]);
    expect(windowsEntries).toEqual([resolvePackagedExecutableName(windowsArtifact)]);
    expect(readFileSync(join(outDir, "install.sh"), "utf8")).toContain("#!/usr/bin/env sh");
  });
});
