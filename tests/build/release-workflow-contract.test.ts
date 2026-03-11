import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml";

function readReleaseWorkflow(): string {
  return readFileSync(RELEASE_WORKFLOW_PATH, "utf8");
}

describe("release workflow contract", () => {
  it("triggers on pushes to main", () => {
    const workflow = readReleaseWorkflow();
    expect(workflow).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*-\s*main/m);
  });

  it("runs quality gates before publishing", () => {
    const workflow = readReleaseWorkflow();
    expect(workflow).toContain("bun test");
    expect(workflow).toContain("bun x tsc --noEmit");
    expect(workflow).toContain("bun run build:compile --version");
    expect(workflow).toContain("bun run release:checksums --dir dist/bin");
    expect(workflow).toContain("bun run release:package --bin-dir dist/bin --out-dir dist/release");
  });

  it("enforces release concurrency and idempotency checks", () => {
    const workflow = readReleaseWorkflow();
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("release-main");
    expect(workflow).toContain("targetCommitish");
    expect(workflow).toContain("GITHUB_SHA");
  });

  it("publishes release assets with gh release create", () => {
    const workflow = readReleaseWorkflow();
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("dist/release/*");
  });
});
