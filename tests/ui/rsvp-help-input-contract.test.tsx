import { describe, expect, it } from "bun:test";
import { getRsvpHelpOverlayInputResult } from "../../src/ui/screens/RSVPScreen";

describe("RSVP help input contract", () => {
  it("uses toggle-first behavior for help visibility", () => {
    expect(getRsvpHelpOverlayInputResult("?", false, false)).toEqual({
      nextHelpVisible: true,
      suppressInput: true,
    });

    expect(getRsvpHelpOverlayInputResult("?", false, true)).toEqual({
      nextHelpVisible: false,
      suppressInput: true,
    });

    expect(getRsvpHelpOverlayInputResult("", true, true)).toEqual({
      nextHelpVisible: false,
      suppressInput: true,
    });
  });
});
