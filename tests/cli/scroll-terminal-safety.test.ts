import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import type { Word } from "../../src/processor/types";
import { GuidedScrollScreen } from "../../src/ui/screens/GuidedScrollScreen";

function makeWordWithText(text: string, index: number): Word {
  return {
    text,
    index,
    paragraphIndex: 0,
    isParagraphStart: index === 0,
    trailingPunctuation: null,
  };
}

describe("scroll terminal safety", () => {
  it("sanitizes ANSI escape sequences in word text", () => {
    const words = [
      makeWordWithText("\u001b[31mred", 0),
      makeWordWithText("normal", 1),
    ];

    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    // ANSI CSI sequences should be stripped
    expect(output).not.toContain("\u001b[31m");
    // The text content (minus escape) should still be present
    expect(output).toContain("red");
  });

  it("sanitizes OSC sequences in word text", () => {
    const words = [
      makeWordWithText("\u001b]0;pwned\u0007hello", 0),
      makeWordWithText("world", 1),
    ];

    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).not.toContain("\u001b]");
    expect(output).not.toContain("\u0007");
    expect(output).toContain("hello");
  });

  it("sanitizes carriage return characters in word text", () => {
    const words = [
      makeWordWithText("before\rafter", 0),
      makeWordWithText("normal", 1),
    ];

    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).not.toContain("\r");
    expect(output).toContain("before");
    expect(output).toContain("after");
  });

  it("sanitizes source label in status bar", () => {
    const words = [makeWordWithText("hello", 0)];

    const output = renderToString(
      React.createElement(GuidedScrollScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "\u001b[31mevil\u001b[0m.txt",
        textScale: "normal" as const,
        mode: "scroll" as const,
      })
    );

    expect(output).not.toContain("\u001b[31m");
    expect(output).toContain("evil");
  });
});
