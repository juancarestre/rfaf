import { describe, expect, it } from "bun:test";
import type { SummaryOption } from "../../src/cli/summary-option";
import { buildReadingPipeline } from "../../src/cli/reading-pipeline";
import type { Word } from "../../src/processor/types";

const tokenizedWords: Word[] = [
  {
    text: "summary",
    index: 0,
    paragraphIndex: 0,
    isParagraphStart: true,
    trailingPunctuation: null,
  },
  {
    text: "content",
    index: 1,
    paragraphIndex: 0,
    isParagraphStart: false,
    trailingPunctuation: null,
  },
  {
    text: "here",
    index: 2,
    paragraphIndex: 0,
    isParagraphStart: false,
    trailingPunctuation: "sentence_end",
  },
];

describe("summary + chunked pipeline", () => {
  it("applies summarize before tokenize and chunk transforms", async () => {
    const calls: string[] = [];
    const summaryOption: SummaryOption = { enabled: true, preset: "medium" };

    const result = await buildReadingPipeline(
      {
        documentContent: "ORIGINAL TEXT",
        sourceLabel: "stdin",
        summaryOption,
        mode: "chunked",
      },
      {
        summarizeBefore: async () => {
          calls.push("summarize");
          return {
            readingContent: "SUMMARIZED TEXT",
            sourceLabel: "stdin (summary:medium)",
          };
        },
        tokenizeFn: (content) => {
          calls.push(`tokenize:${content}`);
          return tokenizedWords;
        },
        chunkFn: (words) => {
          calls.push(`chunk:${words.length}`);
          return words;
        },
      }
    );

    expect(calls).toEqual([
      "summarize",
      "tokenize:SUMMARIZED TEXT",
      `chunk:${tokenizedWords.length}`,
    ]);
    expect(result.sourceLabel).toBe("stdin (summary:medium)");
  });

  it("skips chunk transform when mode is rsvp", async () => {
    const calls: string[] = [];
    const summaryOption: SummaryOption = { enabled: false, preset: null };

    const result = await buildReadingPipeline(
      {
        documentContent: "ORIGINAL TEXT",
        sourceLabel: "stdin",
        summaryOption,
        mode: "rsvp",
      },
      {
        tokenizeFn: (content) => {
          calls.push(`tokenize:${content}`);
          return tokenizedWords;
        },
        chunkFn: (words) => {
          calls.push(`chunk:${words.length}`);
          return words;
        },
      }
    );

    expect(calls).toEqual(["tokenize:ORIGINAL TEXT"]);
    expect(result.words).toBe(tokenizedWords);
  });

  it("does not execute tokenize/chunk when summarize fails in chunked mode", async () => {
    const calls: string[] = [];

    try {
      await buildReadingPipeline(
        {
          documentContent: "ORIGINAL TEXT",
          sourceLabel: "stdin",
          summaryOption: { enabled: true, preset: "medium" },
          mode: "chunked",
        },
        {
          summarizeBefore: async () => {
            calls.push("summarize");
            throw new Error("Summarization failed [runtime]");
          },
          tokenizeFn: (content) => {
            calls.push(`tokenize:${content}`);
            return tokenizedWords;
          },
          chunkFn: (words) => {
            calls.push(`chunk:${words.length}`);
            return words;
          },
        }
      );
      throw new Error("expected summarize failure");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Summarization failed");
    }

    expect(calls).toEqual(["summarize"]);
  });
});
