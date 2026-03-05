import { describe, expect, it } from "bun:test";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";
import { getRemainingSeconds } from "../../src/ui/screens/RSVPScreen";

describe("RSVPScreen remaining time", () => {
  it("keeps legacy WPM estimate for RSVP words", () => {
    const words: Word[] = [
      { text: "one", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
      { text: "two", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "three", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "four", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    ];

    const seconds = getRemainingSeconds(words, 0, 300);
    expect(seconds).toBe(1);
  });

  it("uses chunk-aware timing estimate for chunked words", () => {
    const words: Word[] = [
      { text: "alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
      { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "clause_break" },
      { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: "sentence_end" },
      { text: "epsilon", index: 4, paragraphIndex: 1, isParagraphStart: true, trailingPunctuation: null },
      { text: "zeta", index: 5, paragraphIndex: 1, isParagraphStart: false, trailingPunctuation: null },
    ];

    const chunks = chunkWords(words);
    const seconds = getRemainingSeconds(chunks, 0, 300);
    const legacyChunkEstimate = Math.round(
      (Math.max(0, chunks.length - 1) * 60) / 300
    );

    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeGreaterThan(legacyChunkEstimate);
  });
});
