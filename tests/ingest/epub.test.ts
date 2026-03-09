import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { DEFAULT_MAX_INPUT_BYTES } from "../../src/ingest/constants";
import { readEpubFile } from "../../src/ingest/epub";

const SAMPLE_EPUB_PATH = "tests/fixtures/sample.epub";

describe("readEpubFile", () => {
  it("extracts text from a valid EPUB fixture", async () => {
    const doc = await readEpubFile(SAMPLE_EPUB_PATH);

    expect(doc.content.length).toBeGreaterThan(10);
    expect(doc.content).toContain("Hello EPUB sample text for rfaf tests.");
    expect(doc.content).not.toContain("<p>");
    expect(doc.source).toBe("sample.epub");
    expect(doc.wordCount).toBeGreaterThan(3);
  });

  it("throws when file does not exist", async () => {
    await expect(readEpubFile("tests/fixtures/missing.epub")).rejects.toThrow(
      "File not found"
    );
  });

  it("throws deterministic error when extracted text is empty", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseText: async () => "\n\t  ",
      })
    ).rejects.toThrow("EPUB has no extractable text");
  });

  it("throws deterministic error for encrypted or DRM-protected EPUB files", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseText: async () => {
          const error = new Error("book is drm protected");
          error.name = "EncryptedEpubError";
          throw error;
        },
      })
    ).rejects.toThrow("EPUB is encrypted or DRM-protected");
  });

  it("throws deterministic error for invalid or corrupt EPUB files", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseText: async () => {
          const error = new Error("invalid zip signature");
          error.name = "InvalidEpubError";
          throw error;
        },
      })
    ).rejects.toThrow("Invalid or corrupted EPUB file");
  });

  it("enforces raw byte limit before parser runs", async () => {
    const path = `/tmp/rfaf-epub-large-${Date.now()}.epub`;
    try {
      await Bun.write(path, "A".repeat(64));

      let parseCalls = 0;
      await expect(
        readEpubFile(path, {
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

  it("throws deterministic timeout error when parsing exceeds limit", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseTimeoutMs: 10,
        parseText: () => new Promise<string>(() => {}),
      })
    ).rejects.toThrow("EPUB parsing timed out");
  });

  it("aborts parser signal when timeout is reached", async () => {
    let aborted = false;

    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseTimeoutMs: 10,
        parseText: async (_path, signal) =>
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
    ).rejects.toThrow("EPUB parsing timed out");

    expect(aborted).toBe(true);
  });

  it("normalizes unknown parser errors to deterministic message", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseText: async () => {
          throw new Error("unexpected low-level parser issue");
        },
      })
    ).rejects.toThrow("Failed to parse EPUB file");
  });

  it("preserves deterministic size-limit errors raised by parser path", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        parseText: async () => {
          throw new Error("Input exceeds maximum supported size");
        },
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("enforces extracted text byte limit", async () => {
    await expect(
      readEpubFile(SAMPLE_EPUB_PATH, {
        maxExtractedBytes: 32,
        parseText: async () => "A".repeat(64),
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("accepts extracted text exactly at byte boundary", async () => {
    const content = "A".repeat(DEFAULT_MAX_INPUT_BYTES);

    const doc = await readEpubFile(SAMPLE_EPUB_PATH, {
      parseText: async () => content,
    });

    expect(doc.content.length).toBe(DEFAULT_MAX_INPUT_BYTES);
  });
});
