import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { DEFAULT_MAX_INPUT_BYTES } from "../../src/ingest/constants";
import { readPdfFile } from "../../src/ingest/pdf";

const SAMPLE_PDF_PATH = "tests/fixtures/sample.pdf";

describe("readPdfFile", () => {
  it("extracts text from a valid PDF fixture", async () => {
    const doc = await readPdfFile(SAMPLE_PDF_PATH);

    expect(doc.content.length).toBeGreaterThan(10);
    expect(doc.content).toContain("Hello PDF sample text for rfaf tests.");
    expect(doc.source).toBe("sample.pdf");
    expect(doc.wordCount).toBeGreaterThan(3);
  });

  it("throws when file does not exist", async () => {
    await expect(readPdfFile("tests/fixtures/missing.pdf")).rejects.toThrow(
      "File not found"
    );
  });

  it("throws deterministic error when extracted text is empty", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        parseText: async () => "\n\t  ",
      })
    ).rejects.toThrow("PDF has no extractable text");
  });

  it("throws deterministic error for encrypted or password-protected PDFs", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        parseText: async () => {
          const error = new Error("password required");
          error.name = "PasswordException";
          throw error;
        },
      })
    ).rejects.toThrow("PDF is encrypted or password-protected");
  });

  it("throws deterministic error for invalid or corrupt PDF bytes", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        parseText: async () => {
          const error = new Error("invalid file");
          error.name = "InvalidPDFException";
          throw error;
        },
      })
    ).rejects.toThrow("Invalid or corrupted PDF file");
  });

  it("enforces raw byte limit before parser runs", async () => {
    const path = `/tmp/rfaf-pdf-large-${Date.now()}.pdf`;
    try {
      await Bun.write(path, "A".repeat(64));

      let readBytesCalls = 0;
      let parseCalls = 0;
      await expect(
        readPdfFile(path, {
          maxRawBytes: 32,
          getRawByteLength: async () => 64,
          readBytes: async () => {
            readBytesCalls += 1;
            return new Uint8Array();
          },
          parseText: async () => {
            parseCalls += 1;
            return "unreachable";
          },
        })
      ).rejects.toThrow("Input exceeds maximum supported size");

      expect(readBytesCalls).toBe(0);
      expect(parseCalls).toBe(0);
    } finally {
      await rm(path, { force: true });
    }
  });

  it("throws deterministic timeout error when parsing exceeds limit", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        parseTimeoutMs: 10,
        parseText: () => new Promise<string>(() => {}),
      })
    ).rejects.toThrow("PDF parsing timed out");
  });

  it("normalizes unknown parser errors to deterministic message", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        parseText: async () => {
          throw new Error("unexpected low-level parser issue");
        },
      })
    ).rejects.toThrow("Failed to parse PDF file");
  });

  it("enforces extracted text byte limit", async () => {
    await expect(
      readPdfFile(SAMPLE_PDF_PATH, {
        maxExtractedBytes: 32,
        parseText: async () => "A".repeat(64),
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("accepts extracted text exactly at byte boundary", async () => {
    const content = "A".repeat(DEFAULT_MAX_INPUT_BYTES);

    const doc = await readPdfFile(SAMPLE_PDF_PATH, {
      parseText: async () => content,
    });

    expect(doc.content.length).toBe(DEFAULT_MAX_INPUT_BYTES);
  });
});
