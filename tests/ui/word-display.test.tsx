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
});
