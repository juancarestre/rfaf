import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { HelpOverlay } from "../../src/ui/components/HelpOverlay";

describe("HelpOverlay mode keys", () => {
  it("shows runtime mode switching keys", () => {
    const output = renderToString(React.createElement(HelpOverlay, { mode: "rsvp" }));

    expect(output).toMatch(/1-4\s+switch mode/);
  });

  it("describes scroll stepping in line units", () => {
    const output = renderToString(React.createElement(HelpOverlay, { mode: "scroll" }));

    expect(output).toMatch(/l \/ Right\s+step forward \(line\)/);
    expect(output).toMatch(/h \/ Left\s+step backward \(line\)/);
  });

  it("describes RSVP-family stepping in word units", () => {
    const output = renderToString(React.createElement(HelpOverlay, { mode: "chunked" }));

    expect(output).toMatch(/l \/ Right\s+step forward \(chunk\)/);
    expect(output).toMatch(/h \/ Left\s+step backward \(chunk\)/);
  });
});
