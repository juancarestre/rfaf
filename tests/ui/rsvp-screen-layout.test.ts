import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import type { Word } from "../../src/processor/types";
import type { TextScalePreset } from "../../src/ui/text-scale";
import {
  getReadingLaneLayout,
  RSVPScreen,
} from "../../src/ui/screens/RSVPScreen";

describe("RSVPScreen layout", () => {
  it("keeps reading lane vertically centered without shifting pivot alignment", () => {
    const presets: TextScalePreset[] = ["small", "normal", "large"];

    for (const preset of presets) {
      const layout = getReadingLaneLayout(preset);
      expect(layout.flexDirection).toBe("column");
      expect(layout.justifyContent).toBe("center");
      expect(layout.alignItems).toBe("flex-start");
    }
  });

  it("renders the active word near terminal vertical center", () => {
    const words: Word[] = [
      {
        text: "hello",
        index: 0,
        paragraphIndex: 0,
        isParagraphStart: true,
        trailingPunctuation: null,
      },
    ];

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "rsvp",
      })
    );

    const lines = output.split("\n");
    const wordLine = lines.findIndex((line) => line.includes("hello"));

    expect(wordLine).toBeGreaterThanOrEqual(9);
    expect(wordLine).toBeLessThanOrEqual(14);
  });
});
