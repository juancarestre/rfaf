import { describe, expect, it } from "bun:test";
import { renderToString } from "ink";
import React from "react";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";
import { RSVPScreen } from "../../src/ui/screens/RSVPScreen";

function makeWords(): Word[] {
  return [
    { text: "one", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "two", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "three", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
    { text: "four", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "five", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "six", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
  ];
}

describe("Chunked screen layout", () => {
  it("renders chunk text near vertical center", () => {
    const chunks = chunkWords(makeWords());
    const firstChunkText = chunks[0]?.text ?? "";

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: chunks,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "chunked",
      })
    );

    const lines = output.split("\n");
    const chunkLine = lines.findIndex((line) => line.includes(firstChunkText));

    expect(chunkLine).toBeGreaterThanOrEqual(9);
    expect(chunkLine).toBeLessThanOrEqual(14);
  });

  it("shows chunk-specific start label", () => {
    const chunks = chunkWords(makeWords());

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: chunks,
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "chunked",
      })
    );

    expect(output).toMatch(/\[Chunked\]\s+Pres\.\.\./);
  });

  it("renders key phrase preview before playback start", () => {
    const chunks = chunkWords(makeWords());

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: chunks,
        keyPhrasePreview: ["one two three"],
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "chunked",
      })
    );

    expect(output).toContain("Key phrases:");
    expect(output).toContain("- one two three");
  });

  it("sanitizes key phrase preview text before rendering", () => {
    const chunks = chunkWords(makeWords());

    const output = renderToString(
      React.createElement(RSVPScreen, {
        words: chunks,
        keyPhrasePreview: ["\u001b[31mone two three\u001b[0m"],
        initialWpm: 300,
        sourceLabel: "stdin",
        textScale: "normal",
        mode: "chunked",
      })
    );

    expect(output).toContain("- one two three");
    expect(output).not.toContain("\u001b[");
  });
});
