import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import type { Word } from "../../src/processor/types";
import { App } from "../../src/ui/App";

function makeWords(): Word[] {
  return [
    {
      text: "alpha",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "beta",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "gamma",
      index: 2,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "clause_break",
    },
    {
      text: "delta",
      index: 3,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "epsilon",
      index: 4,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "sentence_end",
    },
  ];
}

describe("App state management", () => {
  it("computes chunked words from sourceWords for the initial mode", () => {
    const output = renderToString(
      React.createElement(App, {
        sourceWords: makeWords(),
        initialMode: "chunked",
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
      })
    );

    expect(output).toContain("Press Space to start (Chunked)");
    expect(output).toContain("alpha beta gamma");
  });

  it("renders GuidedScrollScreen for scroll mode from sourceWords", () => {
    const output = renderToString(
      React.createElement(App, {
        sourceWords: makeWords(),
        initialMode: "scroll",
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
      })
    );

    expect(output).toContain("Press Space to start (Scroll)");
    expect(output).toContain("alpha beta gamma delta epsilon");
  });

  it("initializes reader and session state from the provided initial WPM", () => {
    const output = renderToString(
      React.createElement(App, {
        sourceWords: makeWords(),
        initialMode: "bionic",
        initialWpm: 360,
        sourceLabel: "stdin",
        textScale: "normal",
      })
    );

    expect(output).toContain("Press Space to start (Bionic)");
    expect(output).toContain("360 WPM");
  });
});
