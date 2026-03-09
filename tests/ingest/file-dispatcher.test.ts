import { describe, expect, it } from "bun:test";
import { resolveInputSource } from "../../src/ingest/detect";
import { readFileSource } from "../../src/ingest/file-dispatcher";

function reader(prefix: string, content: string, calls: string[]) {
  return async (path: string) => {
    calls.push(`${prefix}:${path}`);
    return {
      content,
      source: path,
      wordCount: 1,
    };
  };
}

describe("readFileSource", () => {
  const routingCases = [
    {
      path: "tests/fixtures/sample.md",
      expectedCall: "md:tests/fixtures/sample.md",
      expectedContent: "markdown",
    },
    {
      path: "tests/fixtures/SAMPLE.MARKDOWN",
      expectedCall: "md:tests/fixtures/SAMPLE.MARKDOWN",
      expectedContent: "markdown",
    },
    {
      path: "tests/fixtures/sample.epub",
      expectedCall: "epub:tests/fixtures/sample.epub",
      expectedContent: "epub",
    },
    {
      path: "tests/fixtures/SAMPLE.EPUB",
      expectedCall: "epub:tests/fixtures/SAMPLE.EPUB",
      expectedContent: "epub",
    },
    {
      path: "tests/fixtures/sample.pdf",
      expectedCall: "pdf:tests/fixtures/sample.pdf",
      expectedContent: "pdf",
    },
    {
      path: "tests/fixtures/SAMPLE.PDF",
      expectedCall: "pdf:tests/fixtures/SAMPLE.PDF",
      expectedContent: "pdf",
    },
    {
      path: "tests/fixtures/sample.txt",
      expectedCall: "txt:tests/fixtures/sample.txt",
      expectedContent: "txt",
    },
  ] as const;

  for (const entry of routingCases) {
    it(`routes ${entry.path} correctly`, async () => {
      const calls: string[] = [];

      const document = await readFileSource(entry.path, {
        readMarkdownFile: reader("md", "markdown", calls),
        readEpubFile: reader("epub", "epub", calls),
        readPdfFile: reader("pdf", "pdf", calls),
        readPlaintextFile: reader("txt", "txt", calls),
      });

      expect(calls).toEqual([entry.expectedCall]);
      expect(document.content).toBe(entry.expectedContent);
    });
  }

  const lazyCases = [
    {
      label: "markdown",
      path: "tests/fixtures/sample.md",
      loaderKey: "loadMarkdownFileReader",
      expectedContent: "markdown",
    },
    {
      label: "epub",
      path: "tests/fixtures/sample.epub",
      loaderKey: "loadEpubFileReader",
      expectedContent: "epub",
    },
    {
      label: "pdf",
      path: "tests/fixtures/sample.pdf",
      loaderKey: "loadPdfFileReader",
      expectedContent: "pdf",
    },
  ] as const;

  for (const entry of lazyCases) {
    it(`loads ${entry.label} reader lazily only for matching paths`, async () => {
      let loaderCalls = 0;

      const nonMatching = await readFileSource("tests/fixtures/sample.txt", {
        [entry.loaderKey]: async () => {
          loaderCalls += 1;
          return reader(entry.label.slice(0, 2), entry.expectedContent, []);
        },
        readPlaintextFile: async (path: string) => ({
          content: "txt",
          source: path,
          wordCount: 1,
        }),
      });

      expect(loaderCalls).toBe(0);
      expect(nonMatching.content).toBe("txt");

      const matching = await readFileSource(entry.path, {
        [entry.loaderKey]: async () => {
          loaderCalls += 1;
          return async (path: string) => ({
            content: entry.expectedContent,
            source: path,
            wordCount: 1,
          });
        },
        readPlaintextFile: async (path: string) => ({
          content: "txt",
          source: path,
          wordCount: 1,
        }),
      });

      expect(loaderCalls).toBe(1);
      expect(matching.content).toBe(entry.expectedContent);
    });
  }

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
      readPdfFile: reader("pdf", "pdf", calls),
      readPlaintextFile: reader("txt", "txt", calls),
    });

    expect(calls).toEqual(["pdf:tests/fixtures/sample.pdf"]);
  });
});
