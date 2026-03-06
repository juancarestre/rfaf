import { describe, expect, it } from "bun:test";
import { getWordsForMode, transformWordsForMode, type ModeWordCache } from "../../src/processor/mode-transform";
import type { Word } from "../../src/processor/types";

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

describe("mode-transform", () => {
  it("passes through words for rsvp and scroll", () => {
    const words = makeWords();

    expect(transformWordsForMode(words, "rsvp")).toBe(words);
    expect(transformWordsForMode(words, "scroll")).toBe(words);
  });

  it("transforms words for chunked and bionic modes", () => {
    const words = makeWords();
    const chunked = transformWordsForMode(words, "chunked");
    const bionic = transformWordsForMode(words, "bionic");

    expect(chunked).not.toBe(words);
    expect(chunked.length).toBeLessThan(words.length);
    expect(chunked[0]?.sourceWords?.map((word: Word) => word.text)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);

    expect(bionic).not.toBe(words);
    expect(bionic).toHaveLength(words.length);
    expect(bionic[0]?.bionicPrefixLength).toBeGreaterThanOrEqual(1);
  });

  it("caches transformed words by mode and preserves referential equality", () => {
    const words = makeWords();
    const coldCache: ModeWordCache = { rsvp: words };

    const first = getWordsForMode(words, "bionic", coldCache);
    const second = getWordsForMode(words, "bionic", first.modeWordCache);

    expect(first.words).toBe(second.words);
    expect(second.modeWordCache).toBe(first.modeWordCache);
  });

  it("does not mutate the provided cache object on a cache miss", () => {
    const words = makeWords();
    const cache: ModeWordCache = { rsvp: words };

    const result = getWordsForMode(words, "chunked", cache);

    expect(result.modeWordCache).not.toBe(cache);
    expect(cache.chunked).toBeUndefined();
    expect(result.modeWordCache.chunked).toBeDefined();
  });
});
