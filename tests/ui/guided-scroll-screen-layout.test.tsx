import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import type { Word } from "../../src/processor/types";
import { GuidedScrollScreen } from "../../src/ui/screens/GuidedScrollScreen";

function makeWords(): Word[] {
  return [
    { text: "The", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "quick", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "brown", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "fox", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "jumps", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "over", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "the", index: 6, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "lazy", index: 7, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "dog.", index: 8, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
  ];
}

describe("GuidedScrollScreen layout", () => {
  it("renders text content from the word array", () => {
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    // Should render at least the first word from the text
    expect(output).toContain("The");
  });

  it("shows scroll-specific start label", () => {
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).toContain("Press Space to start (Scroll)");
  });

  it("renders status bar with WPM and source label", () => {
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 250,
        sourceLabel: "test.txt",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).toContain("250 WPM");
    expect(output).toContain("test.txt");
  });

  it("renders progress bar", () => {
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words: makeWords(),
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    // Progress bar uses block characters
    expect(output).toContain("0%");
  });

  it("renders multiple words visible simultaneously", () => {
    const words = makeWords();
    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    // In scroll mode, multiple words should be visible at once (not just one like RSVP)
    const visibleWords = words.filter((w) => output.includes(w.text));
    expect(visibleWords.length).toBeGreaterThan(1);
  });
});
