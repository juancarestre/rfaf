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
});
