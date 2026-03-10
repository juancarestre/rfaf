import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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

interface CompileManifest {
  artifacts: Array<{ file: string }>;
}

const METADATA_FILES = new Set([
  "compile-manifest.json",
  "SHA256SUMS",
  "release-manifest.json",
]);
const SAFE_ARTIFACT_FILENAME = /^[A-Za-z0-9._-]+$/;

function assertSafeArtifactName(file: string): void {
  if (!SAFE_ARTIFACT_FILENAME.test(file)) {
    throw new Error(`Unsafe artifact filename for checksum generation: ${file}`);
  }
}

function loadExpectedArtifactNames(outDir: string): string[] {
  const manifestPath = join(outDir, "compile-manifest.json");
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as CompileManifest;

  if (!Array.isArray(parsed.artifacts) || parsed.artifacts.length === 0) {
    throw new Error("compile-manifest.json must include at least one artifact.");
  }

  const expectedNames = parsed.artifacts
    .map((artifact) => basename(artifact.file))
    .sort((a, b) => a.localeCompare(b));

  for (const file of expectedNames) {
    assertSafeArtifactName(file);
  }

  return expectedNames;
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

export function collectReleaseArtifacts(outDir: string): ReleaseArtifactChecksum[] {
  const expectedFiles = loadExpectedArtifactNames(outDir);
  const expectedSet = new Set(expectedFiles);
  const dirEntries = readdirSync(outDir);

  for (const entry of dirEntries) {
    if (METADATA_FILES.has(entry)) continue;
    if (!expectedSet.has(entry)) {
      throw new Error(`Unexpected artifact entry in ${outDir}: ${entry}`);
    }
  }

  const artifacts: ReleaseArtifactChecksum[] = [];

  for (const file of expectedFiles) {
    const fullPath = join(outDir, file);
    const stats = lstatSync(fullPath);

    if (stats.isSymbolicLink()) {
      throw new Error(`Symlink artifacts are not allowed for release checksums: ${file}`);
    }

    if (!stats.isFile()) {
      throw new Error(`Expected artifact file is missing or invalid: ${file}`);
    }

    artifacts.push({
      file,
      sizeBytes: stats.size,
      sha256: sha256File(fullPath),
    });
  }

  if (artifacts.length === 0) {
    throw new Error("No release artifacts found. Refusing to generate checksums.");
  }

  return artifacts;
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
