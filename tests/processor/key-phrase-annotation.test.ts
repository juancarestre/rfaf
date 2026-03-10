import { describe, expect, it } from "bun:test";
import { annotateWordsWithKeyPhrases } from "../../src/processor/key-phrase-annotation";
import type { Word } from "../../src/processor/types";

function wordsFromTokens(tokens: string[]): Word[] {
  return tokens.map((token, index) => ({
    text: token,
    index,
    paragraphIndex: 0,
    isParagraphStart: index === 0,
    trailingPunctuation: null,
  }));
}

describe("annotateWordsWithKeyPhrases", () => {
  it("marks contiguous phrase spans", () => {
    const words = wordsFromTokens(["speed", "reading", "improves", "focus"]);
    const result = annotateWordsWithKeyPhrases(words, ["speed reading"]);

    expect(result[0]?.keyPhraseMatch).toBe(true);
    expect(result[1]?.keyPhraseMatch).toBe(true);
    expect(result[2]?.keyPhraseMatch).toBeUndefined();
  });

  it("matches phrases despite punctuation/case variation", () => {
    const words = wordsFromTokens(["Speed,", "Reading", "improves"]);
    const result = annotateWordsWithKeyPhrases(words, ["speed reading"]);

    expect(result[0]?.keyPhraseMatch).toBe(true);
    expect(result[1]?.keyPhraseMatch).toBe(true);
  });

  it("prioritizes longer phrases to avoid partial overlap drift", () => {
    const words = wordsFromTokens(["optimal", "recognition", "point"]);
    const result = annotateWordsWithKeyPhrases(words, ["recognition", "optimal recognition point"]);

    expect(result.every((word) => word.keyPhraseMatch)).toBe(true);
  });

  it("clears stale key phrase flags on re-annotation", () => {
    const words = wordsFromTokens(["speed", "reading", "focus"]);
    const firstPass = annotateWordsWithKeyPhrases(words, ["speed reading"]);
    const secondPass = annotateWordsWithKeyPhrases(firstPass, ["focus"]);

    expect(secondPass[0]?.keyPhraseMatch).toBeUndefined();
    expect(secondPass[1]?.keyPhraseMatch).toBeUndefined();
    expect(secondPass[2]?.keyPhraseMatch).toBe(true);
  });
});
