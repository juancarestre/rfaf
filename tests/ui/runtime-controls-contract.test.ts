import { describe, expect, it } from "bun:test";
import {
  getCliRuntimeControlLines,
  getHelpOverlayGroups,
  getStatusRuntimeHint,
} from "../../src/runtime-controls";

describe("runtime controls manifest", () => {
  it("keeps CLI runtime control lines aligned with shared controls", () => {
    const lines = getCliRuntimeControlLines().join(" ");

    expect(lines).toContain("1-4 switch mode");
    expect(lines).toContain("? toggle help");
    expect(lines).toContain("Esc close help");
  });

  it("provides overlay rows for toggle and close behavior", () => {
    const rows = getHelpOverlayGroups("word").flatMap((group) => group.rows);
    const descriptions = rows.map((row) => `${row.key} ${row.action}`).join(" | ");

    expect(descriptions).toContain("? toggle help overlay");
    expect(descriptions).toContain("Esc close help overlay");
  });

  it("supports full and compact status runtime hint variants", () => {
    expect(getStatusRuntimeHint("full")).toContain("←/→ nav");
    expect(getStatusRuntimeHint("compact")).toBe("? help");
  });
});
