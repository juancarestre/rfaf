import { describe, expect, it } from "bun:test";
import {
  getPivotStyle,
  getWordDisplayLayout,
} from "../../src/ui/components/WordDisplay";

describe("WordDisplay layout", () => {
  it("keeps pivot at the requested column for different word lengths", () => {
    const pivotColumn = 12;

    const hello = getWordDisplayLayout("hello", pivotColumn);
    expect(hello.leftPadding.length + hello.before.length).toBe(pivotColumn);

    const internationalization = getWordDisplayLayout(
      "internationalization",
      pivotColumn
    );
    expect(
      internationalization.leftPadding.length + internationalization.before.length
    ).toBe(pivotColumn);
  });

  it("uses red pivot style by default", () => {
    expect(getPivotStyle(false)).toEqual({ bold: true, color: "red" });
  });

  it("falls back to underline when NO_COLOR is enabled", () => {
    expect(getPivotStyle(true)).toEqual({ bold: true, underline: true });
  });

  it("uses subtle pivot style without color emphasis when requested", () => {
    expect(getPivotStyle(false, "subtle")).toEqual({ bold: true });
    expect(getPivotStyle(true, "subtle")).toEqual({ bold: true });
  });

  it("sanitizes terminal escape sequences from rendered word layout", () => {
    const layout = getWordDisplayLayout("safe\u001b[31mevil\u001b[0m", 12);
    expect(layout.before + layout.pivot + layout.after).toBe("safeevil");
  });

  it("renders bionic prefix emphasis in display layout only", () => {
    const layout = getWordDisplayLayout("reader", 12, "normal", 2);
    expect(layout.before + layout.pivot + layout.after).toBe("REader");
  });

  it("emphasizes full word when key phrase match is present", () => {
    const layout = getWordDisplayLayout("reader", 12, "normal", 0, true);
    expect(layout.before + layout.pivot + layout.after).toBe("READER");
  });

  it("uses expanded uppercase spacing for large-word mode", () => {
    const layout = getWordDisplayLayout("hello", 12, "expanded");
    expect(layout.before).toBe("H ");
    expect(layout.pivot).toBe("E");
    expect(layout.after).toBe(" L L O");
    expect(layout.leftPadding.length + layout.before.length).toBe(12);
  });

  it("caps expanded rendering for oversized words", () => {
    const oversized = "a".repeat(400);
    const layout = getWordDisplayLayout(oversized, 12, "expanded");
    const renderedWord = layout.before + layout.pivot + layout.after;

    expect(renderedWord).toContain(". . .");
    expect(renderedWord.length).toBeLessThan(520);
  });
});
