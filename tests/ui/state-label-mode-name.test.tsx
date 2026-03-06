import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { createReader } from "../../src/engine/reader";
import { createSession, markPlayStarted } from "../../src/engine/session";
import type { Word } from "../../src/processor/types";
import { App } from "../../src/ui/App";
import { RSVPScreen } from "../../src/ui/screens/RSVPScreen";

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
      trailingPunctuation: "sentence_end",
    },
  ];
}

describe("state label mode names", () => {
  it("includes the mode name in the RSVP idle label", () => {
    const output = renderToString(
      React.createElement(App, {
        sourceWords: makeWords(),
        initialMode: "rsvp",
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
      })
    );

    expect(output).toContain("Press Space to start (RSVP)");
  });

  it("shows Paused after switching rather than a transient switched label", () => {
    const words = makeWords();
    const reader = { ...createReader(words, 300), currentIndex: 1, state: "paused" as const };
    const session = markPlayStarted(createSession(300), 0);
    const output = renderToString(
      React.createElement(RSVPScreen, {
        words,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "bionic",
        reader,
        session,
        updateReader: () => undefined,
      })
    );

    expect(output).toContain("Paused");
    expect(output).not.toContain("Switched to");
  });
});
