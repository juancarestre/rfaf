import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { HelpOverlay } from "../../src/ui/components/HelpOverlay";

describe("HelpOverlay", () => {
  it("renders keybindings text", () => {
    const output = renderToString(React.createElement(HelpOverlay));
    expect(output).toContain("Keybindings");
    expect(output).toContain("Space  pause/resume");
  });

  it("supports custom padding values for readability presets", () => {
    const output = renderToString(
      React.createElement(HelpOverlay, {
        paddingX: 3,
        paddingY: 1,
      })
    );

    expect(output).toContain("Keybindings");
  });
});
