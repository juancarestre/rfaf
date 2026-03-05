import { describe, expect, it } from "bun:test";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";

function makeWords(): Word[] {
  return [
    { text: "one", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
    { text: "two", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "three", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
    { text: "four", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "five", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "six", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    { text: "seven", index: 6, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
    { text: "eight", index: 7, paragraphIndex: 1, isParagraphStart: true, trailingPunctuation: null },
    { text: "nine", index: 8, paragraphIndex: 1, isParagraphStart: false, trailingPunctuation: null },
  ];
}

describe("chunkWords", () => {
  it("creates deterministic adaptive 3-5 word chunks", () => {
    const chunks = chunkWords(makeWords());

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.sourceWords?.length).toBe(3);
    expect(chunks[1]?.sourceWords?.length).toBeGreaterThanOrEqual(3);
    expect(chunks[1]?.sourceWords?.length).toBeLessThanOrEqual(5);
  });

  it("does not drop or duplicate words", () => {
    const words = makeWords();
    const chunks = chunkWords(words);

    const flattened = chunks.flatMap((chunk) => chunk.sourceWords ?? []);
    expect(flattened.map((word) => word.text)).toEqual(words.map((word) => word.text));
  });

  it("marks chunk metadata from first and last source words", () => {
    const chunks = chunkWords(makeWords());
    const first = chunks[0];

    expect(first?.isParagraphStart).toBe(true);
    expect(first?.paragraphIndex).toBe(0);
    expect(first?.trailingPunctuation).toBe("clause_break");
  });

  it("allows deterministic short tail chunks when remaining words are below min size", () => {
    const chunks = chunkWords(makeWords());
    const last = chunks[chunks.length - 1];
    expect(last?.sourceWords?.length).toBeGreaterThanOrEqual(1);
    expect(last?.sourceWords?.length).toBeLessThanOrEqual(5);
  });

  it("splits early on punctuation to avoid commas/dots in the middle of a chunk", () => {
    const words: Word[] = [
      { text: "Alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
      { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
      { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "epsilon", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
    ];

    const chunks = chunkWords(words);
    const firstChunkTexts = chunks[0]?.sourceWords?.map((word) => word.text);

    expect(firstChunkTexts).toEqual(["Alpha", "beta"]);
    expect(chunks[0]?.trailingPunctuation).toBe("clause_break");
  });
});
