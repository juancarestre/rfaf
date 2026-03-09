import { describe, expect, it } from "bun:test";
import { buildReadingPipeline } from "../../src/cli/reading-pipeline";

describe("no-bs + summary ordering", () => {
  it("runs no-bs before summary regardless of later transforms", async () => {
    const calls: string[] = [];

    const result = await buildReadingPipeline(
      {
        documentContent: "ORIGINAL TEXT",
        sourceLabel: "stdin",
        noBsOption: { enabled: true },
        summaryOption: { enabled: true, preset: "medium" },
        mode: "rsvp",
      },
      {
        noBsBefore: async (input) => {
          calls.push(`no-bs:${input.documentContent}`);
          return {
            readingContent: "CLEAN TEXT",
            sourceLabel: "stdin (no-bs)",
          };
        },
        summarizeBefore: async (input) => {
          calls.push(`summary:${input.documentContent}`);
          return {
            readingContent: "SUMMARY TEXT",
            sourceLabel: "stdin (no-bs) (summary:medium)",
          };
        },
        tokenizeFn: (content) => {
          calls.push(`tokenize:${content}`);
          return [
            {
              text: "summary",
              index: 0,
              paragraphIndex: 0,
              isParagraphStart: true,
              trailingPunctuation: null,
            },
          ];
        },
      }
    );

    expect(calls).toEqual([
      "no-bs:ORIGINAL TEXT",
      "summary:CLEAN TEXT",
      "tokenize:SUMMARY TEXT",
    ]);
    expect(result.sourceLabel).toContain("no-bs");
    expect(result.sourceLabel).toContain("summary:medium");
  });

  it("runs no-bs then summary then translate before tokenize", async () => {
    const calls: string[] = [];

    await buildReadingPipeline(
      {
        documentContent: "ORIGINAL TEXT",
        sourceLabel: "stdin",
        noBsOption: { enabled: true },
        summaryOption: { enabled: true, preset: "medium" },
        translateOption: { enabled: true, target: "es" },
        mode: "rsvp",
      },
      {
        noBsBefore: async (input) => {
          calls.push(`no-bs:${input.documentContent}`);
          return {
            readingContent: "CLEAN TEXT",
            sourceLabel: "stdin (no-bs)",
          };
        },
        summarizeBefore: async (input) => {
          calls.push(`summary:${input.documentContent}`);
          return {
            readingContent: "SUMMARY TEXT",
            sourceLabel: "stdin (no-bs) (summary:medium)",
          };
        },
        translateBefore: async (input) => {
          calls.push(`translate:${input.documentContent}`);
          return {
            readingContent: "TRANSLATED TEXT",
            sourceLabel: "stdin (no-bs) (summary:medium) (translated:es)",
          };
        },
        tokenizeFn: (content) => {
          calls.push(`tokenize:${content}`);
          return [
            {
              text: "texto",
              index: 0,
              paragraphIndex: 0,
              isParagraphStart: true,
              trailingPunctuation: null,
            },
          ];
        },
      }
    );

    expect(calls).toEqual([
      "no-bs:ORIGINAL TEXT",
      "summary:CLEAN TEXT",
      "translate:SUMMARY TEXT",
      "tokenize:TRANSLATED TEXT",
    ]);
  });
});
