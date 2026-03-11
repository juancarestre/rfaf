import { describe, expect, it } from "bun:test";
import { chunkWords } from "../../src/processor/chunker";
import type { Word } from "../../src/processor/types";
import { getWordDisplayLayout } from "../../src/ui/components/WordDisplay";

describe("chunked ORP contract", () => {
  it("never highlights whitespace for chunk text rendered by WordDisplay", () => {
    const words: Word[] = [
      {
        text: "ab",
        index: 0,
        paragraphIndex: 0,
        isParagraphStart: true,
        trailingPunctuation: null,
      },
      {
        text: "cde",
        index: 1,
        paragraphIndex: 0,
        isParagraphStart: false,
        trailingPunctuation: "clause_break",
      },
      {
        text: "fgh",
        index: 2,
        paragraphIndex: 0,
        isParagraphStart: false,
        trailingPunctuation: null,
      },
    ];

    const chunks = chunkWords(words);
    const firstChunk = chunks[0];
    expect(firstChunk?.text).toBe("ab cde");

    const layout = getWordDisplayLayout(firstChunk?.text ?? "", 12);
    expect(layout.pivot).toBe("c");
    expect(layout.pivot.trim()).not.toBe("");
  });
});
