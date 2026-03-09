import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { DEFAULT_MAX_INPUT_BYTES } from "../../src/ingest/constants";
import { readMarkdownFile } from "../../src/ingest/markdown";

const SAMPLE_MARKDOWN_PATH = "tests/fixtures/sample.md";

describe("readMarkdownFile", () => {
  it("normalizes markdown into reader-friendly prose with structure cues", async () => {
    const doc = await readMarkdownFile(SAMPLE_MARKDOWN_PATH);

    expect(doc.content).toContain("# Quick Start");
    expect(doc.content).toContain("- Install dependencies");
    expect(doc.content).toContain("Read docs");
    expect(doc.content).toContain("[code block omitted]");
    expect(doc.content).toContain("[image omitted]");
    expect(doc.content).toContain("[table omitted]");
    expect(doc.content).not.toContain("https://example.com/docs");
    expect(doc.content).not.toContain("npm run build");
    expect(doc.source).toBe("sample.md");
    expect(doc.wordCount).toBeGreaterThan(5);
  });

  it("collapses uppercase raw HTML tables to placeholder", async () => {
    const doc = await readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
      parseText: async () => "[table omitted]",
    });

    expect(doc.content).toContain("[table omitted]");
  });

  it("handles malformed markdown deterministically without crashing", async () => {
    const doc = await readMarkdownFile("tests/fixtures/malformed.md");

    expect(doc.content.length).toBeGreaterThan(10);
    expect(doc.wordCount).toBeGreaterThan(2);
  });

  it("throws when file does not exist", async () => {
    await expect(readMarkdownFile("tests/fixtures/missing.md")).rejects.toThrow(
      "File not found"
    );
  });

  it("throws deterministic error when normalized markdown has no readable text", async () => {
    await expect(
      readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
        parseText: async () => "\n\t",
      })
    ).rejects.toThrow("Markdown has no readable text");
  });

  it("throws deterministic error for binary markdown files", async () => {
    const path = `/tmp/rfaf-markdown-binary-${Date.now()}.md`;
    try {
      await Bun.write(path, new Uint8Array([65, 0, 66]));

      await expect(readMarkdownFile(path)).rejects.toThrow("Binary file detected");
    } finally {
      await rm(path, { force: true });
    }
  });

  it("enforces raw byte limit before parser runs", async () => {
    const path = `/tmp/rfaf-markdown-large-${Date.now()}.md`;
    try {
      await Bun.write(path, "A".repeat(64));

      let parseCalls = 0;
      await expect(
        readMarkdownFile(path, {
          maxRawBytes: 32,
          getRawByteLength: async () => 64,
          parseText: async () => {
            parseCalls += 1;
            return "unreachable";
          },
        })
      ).rejects.toThrow("Input exceeds maximum supported size");

      expect(parseCalls).toBe(0);
    } finally {
      await rm(path, { force: true });
    }
  });

  it("normalizes unknown parser errors to deterministic message", async () => {
    await expect(
      readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
        parseText: async () => {
          throw new Error("unexpected markdown parser panic");
        },
      })
    ).rejects.toThrow("Failed to parse Markdown file");
  });

  it("throws deterministic timeout error when parsing exceeds limit", async () => {
    await expect(
      readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
        parseTimeoutMs: 10,
        parseText: () => new Promise<string>(() => {}),
      })
    ).rejects.toThrow("Markdown parsing timed out");
  });

  it("aborts parser signal when markdown timeout is reached", async () => {
    let aborted = false;

    await expect(
      readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
        parseTimeoutMs: 10,
        parseText: async (_content: string, signal?: AbortSignal) =>
          await new Promise<string>((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new Error("aborted"));
              },
              { once: true }
            );
          }),
      })
    ).rejects.toThrow("Markdown parsing timed out");

    expect(aborted).toBe(true);
  });

  it("enforces extracted text byte limit", async () => {
    await expect(
      readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
        maxExtractedBytes: 32,
        parseText: async () => "A".repeat(64),
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("accepts normalized text exactly at byte boundary", async () => {
    const content = "A".repeat(DEFAULT_MAX_INPUT_BYTES);

    const doc = await readMarkdownFile(SAMPLE_MARKDOWN_PATH, {
      parseText: async () => content,
    });

    expect(doc.content.length).toBe(DEFAULT_MAX_INPUT_BYTES);
  });
});
