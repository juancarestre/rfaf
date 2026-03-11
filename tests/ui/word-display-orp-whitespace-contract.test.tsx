import { describe, expect, it } from "bun:test";
import { getWordDisplayLayout } from "../../src/ui/components/WordDisplay";

describe("WordDisplay ORP whitespace contract", () => {
  it("falls back to nearest visible character when raw ORP lands on whitespace", () => {
    const layout = getWordDisplayLayout("ab cde", 12);

    expect(layout.pivot).toBe("c");
    expect(layout.before).toBe("ab ");
    expect(layout.leftPadding.length + layout.before.length).toBe(12);
  });

  it("uses deterministic right-side tie-break for equidistant fallback candidates", () => {
    const layout = getWordDisplayLayout("ab cde", 12);
    expect(layout.pivot).toBe("c");
  });

  it("renders safely when no visible characters are available", () => {
    const layout = getWordDisplayLayout(" \t ", 12);

    expect(layout.before).toBe(" \t ");
    expect(layout.pivot).toBe("");
    expect(layout.after).toBe("");
    expect(layout.leftPadding.length).toBe(9);
    expect(layout.leftPadding.length + layout.before.length).toBe(12);
  });

  it("uses deterministic no-visible layout for empty input", () => {
    const layout = getWordDisplayLayout("", 12);

    expect(layout.before).toBe("");
    expect(layout.pivot).toBe("");
    expect(layout.after).toBe("");
    expect(layout.leftPadding.length).toBe(12);
  });

  it("applies the same non-whitespace fallback in expanded render mode", () => {
    const layout = getWordDisplayLayout("ab cde", 12, "expanded");

    expect(layout.pivot).toBe("C");
  });
});
