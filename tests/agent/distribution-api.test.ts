import { describe, expect, it } from "bun:test";
import {
  executeAgentCompileDistributionCommand,
  executeAgentReleaseChecksumsCommand,
} from "../../src/agent/distribution-api";

describe("agent distribution api", () => {
  it("exposes compile distribution command with deterministic shape", () => {
    const result = executeAgentCompileDistributionCommand(
      {
        outDir: "dist/test-bin",
        currentOnly: true,
        version: "0.1.0",
        cwd: process.cwd(),
      },
      (options) => {
        expect(options.outDir).toBe("dist/test-bin");
        expect(options.currentOnly).toBe(true);
        expect(options.version).toBe("0.1.0");

        return [
          {
            target: "bun-darwin-arm64",
            outfile: "dist/test-bin/rfaf-v0.1.0-bun-darwin-arm64",
            args: [],
          },
        ];
      }
    );

    expect(result.outDir).toBe("dist/test-bin");
    expect(result.artifactCount).toBe(1);
    expect(result.artifacts[0]?.target).toBe("bun-darwin-arm64");
  });

  it("reads package version by default when version is omitted", () => {
    let observedVersion = "";

    executeAgentCompileDistributionCommand(
      {
        outDir: "dist/test-bin",
        currentOnly: true,
      },
      (options) => {
        observedVersion = options.version;
        return [];
      }
    );

    expect(observedVersion).toBe("0.1.0");
  });

  it("exposes release checksum command with deterministic shape", () => {
    const result = executeAgentReleaseChecksumsCommand(
      { outDir: "dist/test-bin" },
      (outDir) => {
        expect(outDir).toBe("dist/test-bin");
        return {
          generatedAt: "2026-03-10T00:00:00.000Z",
          artifactCount: 2,
          artifacts: [
            {
              file: "rfaf-v0.1.0-a",
              sizeBytes: 10,
              sha256: "abc",
            },
            {
              file: "rfaf-v0.1.0-b",
              sizeBytes: 20,
              sha256: "def",
            },
          ],
        };
      }
    );

    expect(result.outDir).toBe("dist/test-bin");
    expect(result.manifest.artifactCount).toBe(2);
  });
});
