import { describe, expect, it } from "bun:test";
import { getScrollHelpOverlayInputResult } from "../../src/ui/screens/GuidedScrollScreen";

describe("scroll help input contract", () => {
  it("suppresses non-close keys while help is visible", () => {
    expect(getScrollHelpOverlayInputResult("l", false, true)).toEqual({
      nextHelpVisible: null,
      suppressInput: true,
    });
  });

  it("opens help with ? when hidden", () => {
    expect(getScrollHelpOverlayInputResult("?", false, false)).toEqual({
      nextHelpVisible: true,
      suppressInput: true,
    });
  });
});
