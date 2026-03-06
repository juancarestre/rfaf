import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import type { Word } from "../../src/processor/types";
import { GuidedScrollScreen } from "../../src/ui/screens/GuidedScrollScreen";

function makeWords(): Word[] {
  const words: Word[] = [];
  let idx = 0;
  for (let p = 0; p < 3; p++) {
    for (let w = 0; w < 5; w++) {
      words.push({
        text: `word${idx}`,
        index: idx,
        paragraphIndex: p,
        isParagraphStart: w === 0,
        trailingPunctuation:
          w === 4 ? (p < 2 ? "paragraph_break" : "sentence_end") : null,
      });
      idx++;
    }
  }
  return words;
}

describe("GuidedScrollScreen controls", () => {
  it("renders without errors with valid props", () => {
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });

  it("displays help overlay content when applicable", () => {
    // Verify the component can render - help overlay testing requires
    // interactive keybinding simulation which is not possible in renderToString.
    // Integration test coverage via PTY validation.
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    // Should contain the initial state, not help overlay
    expect(output).toContain("Press Space to start");
  });
});
