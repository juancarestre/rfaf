import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ReleaseArtifactChecksum {
  file: string;
  sizeBytes: number;
  sha256: string;
}

export interface ReleaseManifest {
  generatedAt: string;
  artifactCount: number;
  artifacts: ReleaseArtifactChecksum[];
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

export function collectReleaseArtifacts(outDir: string): ReleaseArtifactChecksum[] {
  return readdirSync(outDir)
    .filter((entry) => entry !== "SHA256SUMS" && entry !== "release-manifest.json")
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => {
      const fullPath = join(outDir, entry);
      const stats = statSync(fullPath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        file: entry,
        sizeBytes: stats.size,
        sha256: sha256File(fullPath),
      };
    })
    .filter((item): item is ReleaseArtifactChecksum => item !== null);
}

export function renderSha256Sums(artifacts: ReleaseArtifactChecksum[]): string {
  return artifacts.map((artifact) => `${artifact.sha256}  ${artifact.file}`).join("\n");
}

export function buildReleaseManifest(artifacts: ReleaseArtifactChecksum[]): ReleaseManifest {
  return {
    generatedAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    artifacts,
  };
}

export function generateReleaseChecksums(outDir: string): ReleaseManifest {
  const artifacts = collectReleaseArtifacts(outDir);
  const shaContents = renderSha256Sums(artifacts);
  const manifest = buildReleaseManifest(artifacts);

  writeFileSync(join(outDir, "SHA256SUMS"), `${shaContents}\n`);
  writeFileSync(join(outDir, "release-manifest.json"), JSON.stringify(manifest, null, 2));

  return manifest;
}

export function runChecksumCli(args: string[]): void {
  const outDirFlagIndex = args.indexOf("--dir");
  const outDir = outDirFlagIndex >= 0 && args[outDirFlagIndex + 1] ? args[outDirFlagIndex + 1] : "dist/bin";
  const manifest = generateReleaseChecksums(outDir);

  process.stdout.write(`Generated checksums for ${manifest.artifactCount} artifact(s) in ${outDir}\n`);
}

if (import.meta.main) {
  runChecksumCli(process.argv.slice(2));
}
