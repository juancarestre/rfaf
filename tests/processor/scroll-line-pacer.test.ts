import { describe, expect, it } from "bun:test";
import type { Word } from "../../src/processor/types";
import { getDisplayTime } from "../../src/processor/pacer";
import { getLineDwellTime } from "../../src/processor/scroll-line-pacer";

function makeWord(
  text: string,
  index: number,
  trailingPunctuation: Word["trailingPunctuation"] = null
): Word {
  return {
    text,
    index,
    paragraphIndex: 0,
    isParagraphStart: index === 0,
    trailingPunctuation,
  };
}

describe("getLineDwellTime", () => {
  it("returns the sum of getDisplayTime for all words on the line", () => {
    const words = [
      makeWord("hello", 0),
      makeWord("world", 1),
      makeWord("test", 2),
    ];
    const wpm = 300;

    const expected = words.reduce(
      (sum, word) => sum + getDisplayTime(word, wpm),
      0
    );

    expect(getLineDwellTime(words, wpm)).toBeCloseTo(expected, 1);
  });

  it("respects sentence-end multiplier for words on the line", () => {
    const plainWords = [makeWord("hello", 0), makeWord("world", 1)];
    const sentenceWords = [
      makeWord("hello", 0),
      makeWord("world.", 1, "sentence_end"),
    ];

    const plainTime = getLineDwellTime(plainWords, 300);
    const sentenceTime = getLineDwellTime(sentenceWords, 300);

    expect(sentenceTime).toBeGreaterThan(plainTime);
  });

  it("respects paragraph break multiplier", () => {
    const plainWords = [makeWord("hello", 0), makeWord("world", 1)];
    const paragraphWords = [
      makeWord("hello", 0),
      makeWord("world", 1, "paragraph_break"),
    ];

    const plainTime = getLineDwellTime(plainWords, 300);
    const paragraphTime = getLineDwellTime(paragraphWords, 300);

    expect(paragraphTime).toBeGreaterThan(plainTime);
  });

  it("scales with WPM: faster WPM means shorter dwell time", () => {
    const words = [makeWord("hello", 0), makeWord("world", 1)];

    const slowTime = getLineDwellTime(words, 200);
    const fastTime = getLineDwellTime(words, 400);

    expect(fastTime).toBeLessThan(slowTime);
  });

  it("returns 0 for empty word list", () => {
    expect(getLineDwellTime([], 300)).toBe(0);
  });
});
