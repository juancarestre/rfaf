import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import {
  resolveHelpOverlayInput,
  shouldPauseForHelpOverlayOpen,
} from "../../src/ui/help-overlay-input";
import { HelpOverlay } from "../../src/ui/components/HelpOverlay";

describe("help overlay toggle contract", () => {
  it("toggles with ? and closes with Esc", () => {
    expect(resolveHelpOverlayInput({ input: "?", escape: false, helpVisible: false })).toEqual(
      {
        nextHelpVisible: true,
        suppressInput: true,
      }
    );

    expect(resolveHelpOverlayInput({ input: "?", escape: false, helpVisible: true })).toEqual({
      nextHelpVisible: false,
      suppressInput: true,
    });

    expect(resolveHelpOverlayInput({ input: "", escape: true, helpVisible: true })).toEqual({
      nextHelpVisible: false,
      suppressInput: true,
    });
  });

  it("suppresses non-close keys while help is visible", () => {
    expect(resolveHelpOverlayInput({ input: "k", escape: false, helpVisible: true })).toEqual({
      nextHelpVisible: null,
      suppressInput: true,
    });
  });

  it("pauses playback when opening help from playing state", () => {
    expect(shouldPauseForHelpOverlayOpen("playing", true)).toBe(true);
    expect(shouldPauseForHelpOverlayOpen("paused", true)).toBe(false);
    expect(shouldPauseForHelpOverlayOpen("playing", false)).toBe(false);
  });

  it("renders explicit toggle and close guidance", () => {
    const output = renderToString(React.createElement(HelpOverlay));

    expect(output).toContain("Press ? to toggle this overlay");
    expect(output).toContain("Press Esc to close");
  });
});
