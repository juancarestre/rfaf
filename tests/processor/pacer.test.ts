import { describe, expect, it } from "bun:test";
import { getDisplayTime } from "../../src/processor/pacer";
import type { Word } from "../../src/processor/types";

/** Helper to create a Word with defaults */
function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    text: "hello",
    index: 1,
    paragraphIndex: 0,
    isParagraphStart: false,
    trailingPunctuation: null,
    ...overrides,
  };
}

describe("getDisplayTime", () => {
  describe("base timing", () => {
    it("returns roughly 200ms base for a plain word at 300 WPM", () => {
      const word = makeWord({ text: "hello" });
      const time = getDisplayTime(word, 300);
      // base = 60000/300 = 200ms, multiplier = 0.9, length penalty for 5 chars
      // Expected: (0.9 + sqrt(5)*0.04) * 200 ≈ (0.9 + 0.0894) * 200 ≈ 197.9ms
      expect(time).toBeGreaterThan(180);
      expect(time).toBeLessThan(220);
    });

    it("scales inversely with WPM", () => {
      const word = makeWord({ text: "test" });
      const time300 = getDisplayTime(word, 300);
      const time600 = getDisplayTime(word, 600);
      // Should be roughly 2:1 ratio
      expect(time300 / time600).toBeCloseTo(2, 1);
    });

    it("handles 50 WPM (minimum)", () => {
      const word = makeWord({ text: "test" });
      const time = getDisplayTime(word, 50);
      // base = 60000/50 = 1200ms
      expect(time).toBeGreaterThan(1000);
    });

    it("handles 1500 WPM (maximum)", () => {
      const word = makeWord({ text: "test" });
      const time = getDisplayTime(word, 1500);
      // base = 60000/1500 = 40ms
      expect(time).toBeGreaterThan(30);
      expect(time).toBeLessThan(60);
    });
  });

  describe("punctuation multipliers", () => {
    it("applies 3x multiplier for sentence-ending punctuation", () => {
      const plain = makeWord({ text: "hello" });
      const sentenceEnd = makeWord({
        text: "hello.",
        trailingPunctuation: "sentence_end",
      });
      const plainTime = getDisplayTime(plain, 300);
      const sentenceTime = getDisplayTime(sentenceEnd, 300);
      // sentence_end uses 3.0x vs 0.9x for plain
      // Ratio should be roughly 3.0/0.9 ≈ 3.33 (adjusted by length penalty)
      expect(sentenceTime / plainTime).toBeGreaterThan(2.5);
      expect(sentenceTime / plainTime).toBeLessThan(4.0);
    });

    it("applies 2x multiplier for clause-break punctuation", () => {
      const plain = makeWord({ text: "hello" });
      const clauseBreak = makeWord({
        text: "hello,",
        trailingPunctuation: "clause_break",
      });
      const plainTime = getDisplayTime(plain, 300);
      const clauseTime = getDisplayTime(clauseBreak, 300);
      // clause_break uses 2.0x vs 0.9x for plain
      expect(clauseTime / plainTime).toBeGreaterThan(1.8);
      expect(clauseTime / plainTime).toBeLessThan(2.8);
    });

    it("applies paragraph break pause", () => {
      const plain = makeWord({ text: "hello" });
      const paraBreak = makeWord({
        text: "hello.",
        trailingPunctuation: "paragraph_break",
      });
      const plainTime = getDisplayTime(plain, 300);
      const paraTime = getDisplayTime(paraBreak, 300);
      // paragraph_break adds 4.0 * baseMs on top of 0.9x base
      // Should be significantly longer
      expect(paraTime / plainTime).toBeGreaterThan(4);
    });
  });

  describe("word-length penalty", () => {
    it("displays longer words for more time", () => {
      const shortWord = makeWord({ text: "hi" });
      const longWord = makeWord({
        text: "internationalization",
      });
      const shortTime = getDisplayTime(shortWord, 300);
      const longTime = getDisplayTime(longWord, 300);
      expect(longTime).toBeGreaterThan(shortTime);
    });

    it("penalty scales with sqrt of word length", () => {
      const word4 = makeWord({ text: "test" }); // sqrt(4) = 2
      const word16 = makeWord({
        text: "acknowledgements",
      }); // sqrt(16) = 4
      const time4 = getDisplayTime(word4, 300);
      const time16 = getDisplayTime(word16, 300);
      // The difference should reflect sqrt scaling, not linear
      const diff = time16 - time4;
      // sqrt(16) - sqrt(4) = 4 - 2 = 2, * 0.04 * 200 = 16ms
      expect(diff).toBeGreaterThan(10);
      expect(diff).toBeLessThan(25);
    });
  });

  describe("first word minimum", () => {
    it("enforces 200ms minimum for the first word", () => {
      const firstWord = makeWord({ text: "Hi", index: 0 });
      const time = getDisplayTime(firstWord, 1500);
      // At 1500 WPM, base = 40ms, but first word should be at least 200ms
      expect(time).toBeGreaterThanOrEqual(200);
    });

    it("does not affect non-first words", () => {
      const secondWord = makeWord({ text: "Hi", index: 1 });
      const time = getDisplayTime(secondWord, 1500);
      // At 1500 WPM with short word, should be less than 200ms
      expect(time).toBeLessThan(200);
    });

    it("does not reduce first word if already above 200ms", () => {
      const firstWord = makeWord({ text: "hello", index: 0 });
      const notFirstWord = makeWord({ text: "hello", index: 1 });
      const firstTime = getDisplayTime(firstWord, 100);
      const otherTime = getDisplayTime(notFirstWord, 100);
      // At 100 WPM, time is already > 200ms, so first word rule shouldn't change it
      expect(firstTime).toBe(otherTime);
    });
  });

  describe("integration scenarios", () => {
    it("100 plain words at 300 WPM takes ~18-22 seconds total", () => {
      // Create 100 plain words
      const words: Word[] = Array.from({ length: 100 }, (_, i) =>
        makeWord({ text: "word", index: i })
      );
      const totalTime = words.reduce(
        (sum, w) => sum + getDisplayTime(w, 300),
        0
      );
      const totalSeconds = totalTime / 1000;
      expect(totalSeconds).toBeGreaterThan(18);
      expect(totalSeconds).toBeLessThan(22);
    });
  });
});
