import { describe, expect, it } from "bun:test";
import { tokenize } from "../../src/processor/tokenizer";
import type { Word, PunctuationTier } from "../../src/processor/types";

describe("tokenize", () => {
  describe("basic word splitting", () => {
    it("splits simple text into words", () => {
      const words = tokenize("hello world");
      expect(words).toHaveLength(2);
      expect(words[0].text).toBe("hello");
      expect(words[1].text).toBe("world");
    });

    it("assigns sequential indices", () => {
      const words = tokenize("one two three");
      expect(words[0].index).toBe(0);
      expect(words[1].index).toBe(1);
      expect(words[2].index).toBe(2);
    });

    it("handles multiple spaces between words", () => {
      const words = tokenize("hello   world");
      expect(words).toHaveLength(2);
      expect(words[0].text).toBe("hello");
      expect(words[1].text).toBe("world");
    });

    it("handles tabs and mixed whitespace", () => {
      const words = tokenize("hello\tworld\t\tfoo");
      expect(words).toHaveLength(3);
    });

    it("trims leading and trailing whitespace", () => {
      const words = tokenize("  hello world  ");
      expect(words).toHaveLength(2);
      expect(words[0].text).toBe("hello");
    });

    it("handles single word", () => {
      const words = tokenize("Hello");
      expect(words).toHaveLength(1);
      expect(words[0].text).toBe("Hello");
      expect(words[0].index).toBe(0);
    });
  });

  describe("error handling", () => {
    it("throws on empty string", () => {
      expect(() => tokenize("")).toThrow("File is empty");
    });

    it("throws on whitespace-only string", () => {
      expect(() => tokenize("   \n\n  \t  ")).toThrow("File is empty");
    });
  });

  describe("paragraph detection", () => {
    it("detects paragraph breaks from double newlines", () => {
      const words = tokenize("first paragraph\n\nsecond paragraph");
      // "first" and "paragraph" are in paragraph 0
      expect(words[0].paragraphIndex).toBe(0);
      expect(words[1].paragraphIndex).toBe(0);
      // "second" and "paragraph" are in paragraph 1
      expect(words[2].paragraphIndex).toBe(1);
      expect(words[3].paragraphIndex).toBe(1);
    });

    it("marks first word of each paragraph", () => {
      const words = tokenize("first paragraph\n\nsecond paragraph");
      expect(words[0].isParagraphStart).toBe(true);
      expect(words[1].isParagraphStart).toBe(false);
      expect(words[2].isParagraphStart).toBe(true);
      expect(words[3].isParagraphStart).toBe(false);
    });

    it("collapses multiple blank lines into one paragraph break", () => {
      const words = tokenize("first\n\n\n\n\nsecond");
      expect(words[0].paragraphIndex).toBe(0);
      expect(words[1].paragraphIndex).toBe(1);
    });

    it("single newline does NOT create a paragraph break", () => {
      const words = tokenize("first\nsecond");
      expect(words[0].paragraphIndex).toBe(0);
      expect(words[1].paragraphIndex).toBe(0);
    });

    it("handles three paragraphs", () => {
      const words = tokenize("a\n\nb\n\nc");
      expect(words[0].paragraphIndex).toBe(0);
      expect(words[1].paragraphIndex).toBe(1);
      expect(words[2].paragraphIndex).toBe(2);
    });

    it("marks last word before paragraph break with paragraph_break punctuation", () => {
      const words = tokenize("end here\n\nnext part");
      expect(words[1].trailingPunctuation).toBe("paragraph_break");
    });
  });

  describe("punctuation detection", () => {
    it("detects sentence-ending period", () => {
      const words = tokenize("hello world.");
      expect(words[1].trailingPunctuation).toBe("sentence_end");
    });

    it("detects sentence-ending exclamation", () => {
      const words = tokenize("hello world!");
      expect(words[1].trailingPunctuation).toBe("sentence_end");
    });

    it("detects sentence-ending question mark", () => {
      const words = tokenize("hello world?");
      expect(words[1].trailingPunctuation).toBe("sentence_end");
    });

    it("detects period inside quotes", () => {
      const words = tokenize('he said "hello."');
      const lastWord = words[words.length - 1];
      expect(lastWord.trailingPunctuation).toBe("sentence_end");
    });

    it("detects comma as clause break", () => {
      const words = tokenize("hello, world");
      expect(words[0].trailingPunctuation).toBe("clause_break");
    });

    it("detects semicolon as clause break", () => {
      const words = tokenize("hello; world");
      expect(words[0].trailingPunctuation).toBe("clause_break");
    });

    it("detects colon as clause break", () => {
      const words = tokenize("hello: world");
      expect(words[0].trailingPunctuation).toBe("clause_break");
    });

    it("returns null for words without trailing punctuation", () => {
      const words = tokenize("hello world");
      expect(words[0].trailingPunctuation).toBeNull();
      expect(words[1].trailingPunctuation).toBeNull();
    });

    it("handles mixed punctuation in a sentence", () => {
      const words = tokenize("Hello, world. How are you? Fine; thanks!");
      expect(words[0].trailingPunctuation).toBe("clause_break");  // Hello,
      expect(words[1].trailingPunctuation).toBe("sentence_end");  // world.
      expect(words[2].trailingPunctuation).toBeNull();             // How
      expect(words[3].trailingPunctuation).toBeNull();             // are
      expect(words[4].trailingPunctuation).toBe("sentence_end");  // you?
      expect(words[5].trailingPunctuation).toBe("clause_break");  // Fine;
      expect(words[6].trailingPunctuation).toBe("sentence_end");  // thanks!
    });

    it("paragraph_break takes precedence over sentence_end for last word before break", () => {
      const words = tokenize("end.\n\nnext");
      // "end." ends with a period AND is followed by paragraph break
      // paragraph_break should take precedence (higher multiplier)
      expect(words[0].trailingPunctuation).toBe("paragraph_break");
    });
  });

  describe("special tokens", () => {
    it("keeps hyphenated words as one token", () => {
      const words = tokenize("well-known fact");
      expect(words).toHaveLength(2);
      expect(words[0].text).toBe("well-known");
    });

    it("keeps contractions as one token", () => {
      const words = tokenize("don't it's won't");
      expect(words).toHaveLength(3);
      expect(words[0].text).toBe("don't");
    });

    it("keeps numbers with commas as one token", () => {
      const words = tokenize("about 3,000,000 people");
      expect(words).toHaveLength(3);
      expect(words[1].text).toBe("3,000,000");
    });

    it("keeps URLs as one token", () => {
      const words = tokenize("visit https://example.com/path today");
      expect(words).toHaveLength(3);
      expect(words[1].text).toBe("https://example.com/path");
    });
  });
});
