import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { HelpOverlay } from "../../src/ui/components/HelpOverlay";

describe("help overlay runtime-controls copy", () => {
  it("lists the runtime control categories with explanatory wording", () => {
    const output = renderToString(React.createElement(HelpOverlay, { mode: "rsvp" }));

    expect(output).toContain("Runtime Controls");
    expect(output).toContain("Playback");
    expect(output).toContain("Navigation");
    expect(output).toContain("Speed");
    expect(output).toContain("Session");
    expect(output).toMatch(/\?\s+toggle help overlay/);
    expect(output).toMatch(/Esc\s+close help overlay/);
  });
});
