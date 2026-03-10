import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReleaseManifest,
  collectReleaseArtifacts,
  generateReleaseChecksums,
  renderSha256Sums,
} from "../../scripts/release/generate-checksums";

function writeCompileManifest(dir: string, files: string[]): void {
  writeFileSync(
    join(dir, "compile-manifest.json"),
    JSON.stringify(
      {
        artifacts: files.map((file) => ({ file })),
      },
      null,
      2
    )
  );
}

describe("release checksum manifest", () => {
  it("collects deterministic sorted release artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-checksum-collect-"));
    writeFileSync(join(dir, "b-artifact"), "bbb");
    writeFileSync(join(dir, "a-artifact"), "aaa");
    writeCompileManifest(dir, ["b-artifact", "a-artifact"]);

    const artifacts = collectReleaseArtifacts(dir);
    expect(artifacts.map((item) => item.file)).toEqual(["a-artifact", "b-artifact"]);
  });

  it("renders stable SHA256SUMS line format", () => {
    const lines = renderSha256Sums([
      {
        file: "rfaf-a",
        sizeBytes: 10,
        sha256: "abc",
      },
      {
        file: "rfaf-b",
        sizeBytes: 20,
        sha256: "def",
      },
    ]);

    expect(lines).toBe("abc  rfaf-a\ndef  rfaf-b");
  });

  it("builds manifest with accurate artifact count", () => {
    const manifest = buildReleaseManifest([
      {
        file: "rfaf-a",
        sizeBytes: 10,
        sha256: "abc",
      },
    ]);

    expect(manifest.artifactCount).toBe(1);
    expect(manifest.artifacts[0]?.file).toBe("rfaf-a");
    expect(typeof manifest.generatedAt).toBe("string");
  });

  it("writes SHA256SUMS and release-manifest.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-checksum-write-"));
    writeFileSync(join(dir, "rfaf-a"), "artifact A");
    writeFileSync(join(dir, "rfaf-b"), "artifact B");
    writeCompileManifest(dir, ["rfaf-a", "rfaf-b"]);

    const manifest = generateReleaseChecksums(dir);
    const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8");
    const parsedManifest = JSON.parse(
      readFileSync(join(dir, "release-manifest.json"), "utf8")
    ) as { artifactCount: number };

    expect(manifest.artifactCount).toBe(2);
    expect(parsedManifest.artifactCount).toBe(2);
    expect(sums).toContain("rfaf-a");
    expect(sums).toContain("rfaf-b");
  });

  it("fails when unexpected files are present", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-checksum-unexpected-"));
    writeFileSync(join(dir, "rfaf-a"), "artifact A");
    writeFileSync(join(dir, "rogue-file"), "bad");
    writeCompileManifest(dir, ["rfaf-a"]);

    expect(() => collectReleaseArtifacts(dir)).toThrow("Unexpected artifact entry");
  });

  it("fails when compile manifest has no artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-checksum-empty-"));
    writeCompileManifest(dir, []);

    expect(() => collectReleaseArtifacts(dir)).toThrow(
      "compile-manifest.json must include at least one artifact"
    );
  });

  it("rejects symlink artifacts", () => {
    if (process.platform === "win32") {
      return;
    }

    const dir = mkdtempSync(join(tmpdir(), "rfaf-checksum-symlink-"));
    const targetDir = mkdtempSync(join(tmpdir(), "rfaf-checksum-target-"));
    const targetFile = join(targetDir, "target");
    writeFileSync(targetFile, "artifact A");
    symlinkSync(targetFile, join(dir, "rfaf-a"));
    writeCompileManifest(dir, ["rfaf-a"]);

    expect(() => collectReleaseArtifacts(dir)).toThrow(
      "Symlink artifacts are not allowed for release checksums"
    );
  });
});
