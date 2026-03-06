import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { applyBionicMode } from "../../src/processor/bionic";
import type { Word } from "../../src/processor/types";
import { RSVPScreen } from "../../src/ui/screens/RSVPScreen";

function makeWords(): Word[] {
  return [
    { text: "reader", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "comprehension", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "improves", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
  ];
}

describe("Bionic screen layout", () => {
  it("renders emphasized bionic word near vertical center", () => {
    const bionicWords = applyBionicMode(makeWords());
    const firstWord = bionicWords[0]?.text ?? "";

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: bionicWords,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "bionic",
      })
    );

    const lines = output.split("\n");
    const wordLine = lines.findIndex((line) =>
      line.toLowerCase().includes(firstWord.toLowerCase())
    );

    expect(wordLine).toBeGreaterThanOrEqual(9);
    expect(wordLine).toBeLessThanOrEqual(14);
  });

  it("shows bionic-specific start label", () => {
    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: applyBionicMode(makeWords()),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "bionic",
      })
    );

    expect(output).toContain("Press Space to start (Bionic)");
  });
});
