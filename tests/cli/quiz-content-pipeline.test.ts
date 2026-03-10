import { describe, expect, it } from "bun:test";
import { buildTransformedContentPipeline } from "../../src/cli/reading-pipeline";

describe("buildTransformedContentPipeline", () => {
  it("runs no-bs, summary, then translate in deterministic order", async () => {
    const calls: string[] = [];

    const result = await buildTransformedContentPipeline(
      {
        documentContent: "ORIGINAL TEXT",
        sourceLabel: "stdin",
        noBsOption: { enabled: true },
        summaryOption: { enabled: true, preset: "medium" },
        translateOption: { enabled: true, target: "es" },
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
      }
    );

    expect(calls).toEqual([
      "no-bs:ORIGINAL TEXT",
      "summary:CLEAN TEXT",
      "translate:SUMMARY TEXT",
    ]);
    expect(result.readingContent).toBe("TRANSLATED TEXT");
    expect(result.sourceLabel).toBe("stdin (no-bs) (summary:medium) (translated:es)");
  });

  it("returns original content when all pre-read transforms are disabled", async () => {
    const result = await buildTransformedContentPipeline({
      documentContent: "ORIGINAL TEXT",
      sourceLabel: "stdin",
      summaryOption: { enabled: false, preset: null },
      noBsOption: { enabled: false },
      translateOption: { enabled: false, target: null },
    });

    expect(result).toEqual({
      readingContent: "ORIGINAL TEXT",
      sourceLabel: "stdin",
    });
  });
});
