import { describe, expect, it } from "bun:test";
import { getDisplayTime } from "../../src/processor/pacer";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";

function makeWords(): Word[] {
  return [
    { text: "Alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
    { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "epsilon", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "zeta", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
  ];
}

describe("chunked pacing", () => {
  it("keeps WPM semantics by deriving chunk time from source words", () => {
    const words = makeWords();
    const chunks = chunkWords(words);
    const firstChunk = chunks[0];

    if (!firstChunk?.sourceWords) {
      throw new Error("expected first chunk to include sourceWords");
    }

    const chunkTime = getDisplayTime(firstChunk, 300);
    const sourceTime = firstChunk.sourceWords.reduce(
      (total, word) => total + getDisplayTime(word, 300),
      0
    );

    expect(chunkTime).toBe(sourceTime);
  });
});
