import { describe, expect, it } from "bun:test";
import type { Word } from "../../src/processor/types";
import {
  computeLineMap,
  getLineForWordIndex,
  getFirstWordIndexForLine,
  getNextLineStartIndex,
  getPreviousLineStartIndex,
} from "../../src/processor/line-computation";

function makeWord(text: string, index: number, paragraphIndex = 0, isParagraphStart = false): Word {
  return {
    text,
    index,
    paragraphIndex,
    isParagraphStart: isParagraphStart || index === 0,
    trailingPunctuation: null,
  };
}

function makeWords(texts: string[]): Word[] {
  return texts.map((text, i) => makeWord(text, i, 0, i === 0));
}

describe("computeLineMap", () => {
  it("wraps words into lines based on terminal width", () => {
    // Each word is 5 chars + 1 space = 6 chars. Width 20 fits ~3 words per line.
    const words = makeWords(["alpha", "bravo", "chars", "delta", "echo!", "foxes"]);
    const lineMap = computeLineMap(words, 20);

    expect(lineMap.totalLines).toBeGreaterThan(1);
    expect(lineMap.totalLines).toBeLessThanOrEqual(3);
  });

  it("places all words on one line when width is very large", () => {
    const words = makeWords(["short", "text", "here"]);
    const lineMap = computeLineMap(words, 200);

    expect(lineMap.totalLines).toBe(1);
  });

  it("handles single word input", () => {
    const words = makeWords(["hello"]);
    const lineMap = computeLineMap(words, 80);

    expect(lineMap.totalLines).toBe(1);
    expect(getLineForWordIndex(lineMap, 0)).toBe(0);
  });

  it("preserves content integrity: every word appears exactly once", () => {
    const words = makeWords(["one", "two", "three", "four", "five", "six", "seven", "eight"]);
    const lineMap = computeLineMap(words, 15);

    // Collect all word indices from all lines
    const allIndices: number[] = [];
    for (let line = 0; line < lineMap.totalLines; line++) {
      const firstIdx = getFirstWordIndexForLine(lineMap, line);
      const lastIdx = line < lineMap.totalLines - 1
        ? getFirstWordIndexForLine(lineMap, line + 1) - 1
        : words.length - 1;
      for (let i = firstIdx; i <= lastIdx; i++) {
        allIndices.push(i);
      }
    }

    // Every word index 0..N-1 appears exactly once
    expect(allIndices.sort((a, b) => a - b)).toEqual(
      words.map((_, i) => i)
    );
  });

  it("handles long words that exceed terminal width", () => {
    const words = makeWords(["superlongwordthatexceedswidth", "ok"]);
    const lineMap = computeLineMap(words, 10);

    // Long word still gets its own line (not dropped)
    expect(lineMap.totalLines).toBeGreaterThanOrEqual(2);
    expect(getLineForWordIndex(lineMap, 0)).toBe(0);
    expect(getLineForWordIndex(lineMap, 1)).toBeGreaterThanOrEqual(1);
  });

  it("uses sanitized display width when wrapping hostile terminal text", () => {
    const words = makeWords(["safe", "\u001b[31mred", "tail"]);

    const lineMap = computeLineMap(words, 12);

    expect(getLineForWordIndex(lineMap, 0)).toBe(0);
    expect(getLineForWordIndex(lineMap, 1)).toBe(0);
    expect(getLineForWordIndex(lineMap, 2)).toBe(1);
  });
});

describe("getLineForWordIndex", () => {
  it("maps word index to correct line", () => {
    // Width 12: "one two" (7) fits, "three four" (10) fits, "five" separate
    const words = makeWords(["one", "two", "three", "four", "five"]);
    const lineMap = computeLineMap(words, 12);

    // First line should have first few words
    const line0 = getLineForWordIndex(lineMap, 0);
    expect(line0).toBe(0);

    // Last word should be on some line
    const lastLine = getLineForWordIndex(lineMap, 4);
    expect(lastLine).toBeGreaterThanOrEqual(0);
    expect(lastLine).toBeLessThan(lineMap.totalLines);
  });

  it("clamps out-of-bounds word index to last line", () => {
    const words = makeWords(["hello", "world"]);
    const lineMap = computeLineMap(words, 80);

    expect(getLineForWordIndex(lineMap, 999)).toBe(lineMap.totalLines - 1);
  });

  it("clamps negative word index to line 0", () => {
    const words = makeWords(["hello", "world"]);
    const lineMap = computeLineMap(words, 80);

    expect(getLineForWordIndex(lineMap, -1)).toBe(0);
  });
});

describe("line stepping helpers", () => {
  it("returns next and previous line start indices", () => {
    const words = makeWords(["one", "two", "three", "four", "five", "six"]);
    const lineMap = computeLineMap(words, 10);

    const nextStart = getNextLineStartIndex(lineMap, 0);
    expect(nextStart).toBeGreaterThan(0);

    const previousStart = getPreviousLineStartIndex(lineMap, nextStart);
    expect(previousStart).toBe(0);
  });
});

describe("getFirstWordIndexForLine", () => {
  it("returns 0 for line 0", () => {
    const words = makeWords(["a", "b", "c"]);
    const lineMap = computeLineMap(words, 80);

    expect(getFirstWordIndexForLine(lineMap, 0)).toBe(0);
  });

  it("returns correct first word for subsequent lines", () => {
    const words = makeWords(["one", "two", "three", "four", "five", "six"]);
    const lineMap = computeLineMap(words, 10);

    for (let line = 1; line < lineMap.totalLines; line++) {
      const firstIdx = getFirstWordIndexForLine(lineMap, line);
      expect(firstIdx).toBeGreaterThan(0);
      expect(firstIdx).toBeLessThan(words.length);
    }
  });

  it("clamps out-of-bounds line to last line start", () => {
    const words = makeWords(["hello", "world"]);
    const lineMap = computeLineMap(words, 5);

    const lastLineStart = getFirstWordIndexForLine(lineMap, lineMap.totalLines - 1);
    expect(getFirstWordIndexForLine(lineMap, 999)).toBe(lastLineStart);
  });
});
