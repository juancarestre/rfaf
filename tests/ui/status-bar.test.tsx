import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { StatusBar } from "../../src/ui/components/StatusBar";

describe("StatusBar", () => {
  it("sanitizes state and source labels before rendering", () => {
    const output = renderToString(
      React.createElement(StatusBar, {
        wpm: 300,
        remainingSeconds: 10,
        progress: 0.5,
        stateLabel: "ok\u001b[31mbad\u001b[0m",
        sourceLabel: "src\u001b]8;;https://evil\u0007x\u001b]8;;\u0007",
      })
    );

    expect(output).not.toContain("\u001b[31m");
    expect(output).toContain("okbad");
    expect(output).toContain("srcx");
  });

  it("supports custom separator and dim toggle for readability presets", () => {
    const output = renderToString(
      React.createElement(StatusBar, {
        wpm: 300,
        remainingSeconds: 10,
        progress: 0.5,
        stateLabel: "Playing",
        sourceLabel: "stdin",
        separator: "   |   ",
        dimColor: false,
      })
    );

    expect(output).toContain("300 WPM   |   0:10 remaining   |   50%   |   Playing");
    expect(output).toContain("? help, ←/→ nav, ↑/↓");
    expect(output).toContain("speed, r restart, q quit");
    expect(output).toContain("restart, q quit   |   stdin");
    expect(output).not.toContain("\u001b[2m");
  });

  it("uses compact runtime hint and truncates source when width is constrained", () => {
    const output = renderToString(
      React.createElement(StatusBar, {
        wpm: 300,
        remainingSeconds: 107,
        progress: 0.02,
        stateLabel: "Paused",
        sourceLabel: "tests/fixtures/a-very-long-source-label-for-terminal-width-contract.txt",
        activeMode: "rsvp",
        maxWidth: 70,
      })
    );

    expect(output).toContain("? help");
    expect(output).not.toContain("←/→ nav");
    expect(output).toContain("...");
  });
});
