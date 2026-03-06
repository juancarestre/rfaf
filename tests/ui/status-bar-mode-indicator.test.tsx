import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { StatusBar } from "../../src/ui/components/StatusBar";

describe("StatusBar mode indicator", () => {
  it("renders the active reading mode in the status line", () => {
    const output = renderToString(
      React.createElement(StatusBar, {
        wpm: 300,
        remainingSeconds: 10,
        progress: 0.5,
        stateLabel: "Paused",
        sourceLabel: "stdin",
        activeMode: "bionic",
      })
    );

    expect(output).toContain("[Bionic]");
    expect(output).toContain("Paused");
  });
});
