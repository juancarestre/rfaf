import { describe, expect, it } from "bun:test";
import { mapPositionToNewWords } from "../../src/engine/position-mapping";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";

function makeWords(): Word[] {
  return [
    { text: "alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
    { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "epsilon", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
  ];
}

describe("mapPositionToNewWords", () => {
  it("maps positions proportionally between word arrays", () => {
    const currentWords = Array.from({ length: 100 }, (_, index) => ({
      text: `word-${index}`,
      index,
      paragraphIndex: 0,
      isParagraphStart: index === 0,
      trailingPunctuation: null,
    }));
    const targetWords = Array.from({ length: 30 }, (_, index) => ({
      text: `word-${index}`,
      index,
      paragraphIndex: 0,
      isParagraphStart: index === 0,
      trailingPunctuation: null,
    }));

    expect(mapPositionToNewWords(50, currentWords, targetWords)).toBe(15);
  });

  it("returns zero for single-word source or target arrays", () => {
    const singleWord = [makeWords()[0]!];
    expect(mapPositionToNewWords(0, singleWord, makeWords())).toBe(0);
    expect(mapPositionToNewWords(1, makeWords(), singleWord)).toBe(0);
  });

  it("maps the first and last positions to the target boundaries", () => {
    const currentWords = makeWords();
    const targetWords = chunkWords(currentWords);

    expect(mapPositionToNewWords(0, currentWords, targetWords)).toBe(0);
    expect(mapPositionToNewWords(currentWords.length - 1, currentWords, targetWords)).toBe(
      targetWords.length - 1
    );
  });

  it("maps chunked transitions by source-word identity rather than rough percentage", () => {
    const currentWords = makeWords();
    const targetWords = chunkWords(currentWords);

    expect(mapPositionToNewWords(2, currentWords, targetWords)).toBe(0);
    expect(mapPositionToNewWords(4, currentWords, targetWords)).toBe(1);
  });

  it("keeps round-trip drift within one word when identity mapping is unavailable", () => {
    const currentWords = Array.from({ length: 100 }, (_, index) => ({
      text: `word-${index}`,
      index,
      paragraphIndex: 0,
      isParagraphStart: index === 0,
      trailingPunctuation: null,
    }));
    const targetWords = Array.from({ length: 30 }, (_, index) => ({
      text: `rendered-${index}`,
      index: 100 + index,
      paragraphIndex: 0,
      isParagraphStart: index === 0,
      trailingPunctuation: null,
    }));
    const chunkedIndex = mapPositionToNewWords(50, currentWords, targetWords);
    const roundTripped = mapPositionToNewWords(chunkedIndex, targetWords, currentWords);

    expect(chunkedIndex).toBe(15);
    expect(roundTripped).toBe(51);
    expect(Math.abs(roundTripped - 50)).toBeLessThanOrEqual(1);
  });

  it("handles empty arrays defensively", () => {
    expect(mapPositionToNewWords(0, [], [])).toBe(0);
    expect(mapPositionToNewWords(5, makeWords(), [])).toBe(0);
  });
});
