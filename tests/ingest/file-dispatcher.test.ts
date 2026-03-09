import { describe, expect, it } from "bun:test";
import { resolveInputSource } from "../../src/ingest/detect";
import { readFileSource } from "../../src/ingest/file-dispatcher";

describe("readFileSource", () => {
  it("routes .epub files to EPUB ingestor", async () => {
    const calls: string[] = [];

    const document = await readFileSource("tests/fixtures/sample.epub", {
      readEpubFile: async (path: string) => {
        calls.push(`epub:${path}`);
        return { content: "epub", source: path, wordCount: 1 };
      },
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["epub:tests/fixtures/sample.epub"]);
    expect(document.content).toBe("epub");
  });

  it("routes .EPUB files case-insensitively to EPUB ingestor", async () => {
    const calls: string[] = [];

    await readFileSource("tests/fixtures/SAMPLE.EPUB", {
      readEpubFile: async (path: string) => {
        calls.push(`epub:${path}`);
        return { content: "epub", source: path, wordCount: 1 };
      },
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["epub:tests/fixtures/SAMPLE.EPUB"]);
  });

  it("routes .pdf files to PDF ingestor", async () => {
    const calls: string[] = [];

    const document = await readFileSource("tests/fixtures/sample.pdf", {
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["pdf:tests/fixtures/sample.pdf"]);
    expect(document.content).toBe("pdf");
  });

  it("routes .PDF files case-insensitively to PDF ingestor", async () => {
    const calls: string[] = [];

    await readFileSource("tests/fixtures/SAMPLE.PDF", {
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["pdf:tests/fixtures/SAMPLE.PDF"]);
  });

  it("loads PDF reader lazily only for PDF paths", async () => {
    let loadPdfCalls = 0;

    const document = await readFileSource("tests/fixtures/sample.txt", {
      loadPdfFileReader: async () => {
        loadPdfCalls += 1;
        return async (path: string) => ({ content: "pdf", source: path, wordCount: 1 });
      },
      readPlaintextFile: async (path: string) => ({
        content: "txt",
        source: path,
        wordCount: 1,
      }),
    });

    expect(loadPdfCalls).toBe(0);
    expect(document.content).toBe("txt");
  });

  it("loads EPUB reader lazily only for EPUB paths", async () => {
    let loadEpubCalls = 0;

    const document = await readFileSource("tests/fixtures/sample.txt", {
      loadEpubFileReader: async () => {
        loadEpubCalls += 1;
        return async (path: string) => ({ content: "epub", source: path, wordCount: 1 });
      },
      readPlaintextFile: async (path: string) => ({
        content: "txt",
        source: path,
        wordCount: 1,
      }),
    });

    expect(loadEpubCalls).toBe(0);
    expect(document.content).toBe("txt");
  });

  it("uses lazy loader for EPUB paths when no direct reader override is provided", async () => {
    let loadEpubCalls = 0;

    const document = await readFileSource("tests/fixtures/sample.epub", {
      loadEpubFileReader: async () => {
        loadEpubCalls += 1;
        return async (path: string) => ({ content: "epub", source: path, wordCount: 1 });
      },
      readPlaintextFile: async (path: string) => ({
        content: "txt",
        source: path,
        wordCount: 1,
      }),
    });

    expect(loadEpubCalls).toBe(1);
    expect(document.content).toBe("epub");
  });

  it("uses lazy loader for PDF paths when no direct reader override is provided", async () => {
    let loadPdfCalls = 0;

    const document = await readFileSource("tests/fixtures/sample.pdf", {
      loadPdfFileReader: async () => {
        loadPdfCalls += 1;
        return async (path: string) => ({ content: "pdf", source: path, wordCount: 1 });
      },
      readPlaintextFile: async (path: string) => ({
        content: "txt",
        source: path,
        wordCount: 1,
      }),
    });

    expect(loadPdfCalls).toBe(1);
    expect(document.content).toBe("pdf");
  });

  it("routes non-PDF files to plaintext ingestor", async () => {
    const calls: string[] = [];

    const document = await readFileSource("tests/fixtures/sample.txt", {
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["txt:tests/fixtures/sample.txt"]);
    expect(document.content).toBe("txt");
  });

  it("keeps file-over-stdin precedence unchanged from source detection", async () => {
    const source = resolveInputSource({
      fileArg: "tests/fixtures/sample.pdf",
      stdinIsPiped: true,
    });

    expect(source.kind).toBe("file");
    if (source.kind !== "file") {
      throw new Error("Expected file source");
    }

    expect(source.warning).toContain("ignoring stdin");

    const calls: string[] = [];
    await readFileSource(source.path, {
      readPdfFile: async (path: string) => {
        calls.push(`pdf:${path}`);
        return { content: "pdf", source: path, wordCount: 1 };
      },
      readPlaintextFile: async (path: string) => {
        calls.push(`txt:${path}`);
        return { content: "txt", source: path, wordCount: 1 };
      },
    });

    expect(calls).toEqual(["pdf:tests/fixtures/sample.pdf"]);
  });
});
