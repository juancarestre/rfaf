import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const README_PATH = "README.md";

function readReadme(): string {
  return readFileSync(README_PATH, "utf8");
}

describe("README installation contract", () => {
  it("makes prebuilt binaries the primary installation path", () => {
    const readme = readReadme();
    const binariesSectionIndex = readme.indexOf("### 1) Install prebuilt binaries (recommended)");
    const sourceSectionIndex = readme.indexOf("### 2) Build from source with Bun");

    expect(binariesSectionIndex).toBeGreaterThan(-1);
    expect(sourceSectionIndex).toBeGreaterThan(-1);
    expect(binariesSectionIndex).toBeLessThan(sourceSectionIndex);
  });

  it("documents direct install steps for macOS, Linux, and Windows", () => {
    const readme = readReadme();
    expect(readme).toContain("#### macOS");
    expect(readme).toContain("#### Linux");
    expect(readme).toContain("#### Windows (PowerShell)");
    expect(readme).toContain("releases/download");
  });

  it("includes checksum verification guidance for release downloads", () => {
    const readme = readReadme();
    expect(readme).toContain("SHA256SUMS");
    expect(readme).toContain("shasum -a 256");
    expect(readme).toContain("Get-FileHash");
  });
});
