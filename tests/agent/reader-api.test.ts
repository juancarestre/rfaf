import { describe, expect, it } from "bun:test";
import {
  AgentIngestFileError,
  createAgentReaderRuntime,
  executeAgentCommand,
  executeAgentIngestFileCommand,
  executeAgentIngestUrlCommand,
  executeAgentSummarizeCommand,
  getAgentReaderState,
} from "../../src/agent/reader-api";
import type { Word } from "../../src/processor/types";

function words(): Word[] {
  return [
    {
      text: "first",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "second",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "paragraph_break",
    },
    {
      text: "third",
      index: 2,
      paragraphIndex: 1,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
  ];
}

describe("agent reader api", () => {
  it("creates runtime and returns structured state", () => {
    const runtime = createAgentReaderRuntime(words(), 300);
    const state = getAgentReaderState(runtime);

    expect(state.mode).toBe("paused");
    expect(state.currentIndex).toBe(0);
    expect(state.currentWpm).toBe(300);
    expect(state.textScale).toBe("normal");
    expect(state.totalWords).toBe(3);
    expect(state.progress).toBe(0);
    expect(state.readingMode).toBe("rsvp");
    expect(state.summaryEnabled).toBe(false);
    expect(state.summaryPreset).toBe("medium");
    expect(state.summaryProvider).toBeNull();
  });

  it("supports runtime text-scale configuration", () => {
    const runtime = createAgentReaderRuntime(words(), 300, "large");
    expect(getAgentReaderState(runtime).textScale).toBe("large");
  });

  it("supports play/pause and stepping commands", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, { type: "play_pause" }, 1_000);
    runtime = executeAgentCommand(runtime, { type: "step_next" }, 1_100);

    const state = getAgentReaderState(runtime);
    expect(state.mode).toBe("paused");
    expect(state.currentIndex).toBe(1);
  });

  it("supports paragraph jump and restart", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, { type: "jump_next_paragraph" }, 1_000);

    expect(getAgentReaderState(runtime).currentIndex).toBe(2);

    runtime = executeAgentCommand(runtime, { type: "restart" }, 1_100);
    const state = getAgentReaderState(runtime);
    expect(state.currentIndex).toBe(0);
    expect(state.mode).toBe("paused");
  });

  it("supports speed adjustment and clamps within bounds", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, { type: "set_wpm_delta", delta: 2_000 }, 0);
    expect(getAgentReaderState(runtime).currentWpm).toBe(1500);

    runtime = executeAgentCommand(runtime, { type: "set_wpm_delta", delta: -2_000 }, 0);
    expect(getAgentReaderState(runtime).currentWpm).toBe(50);
  });

  it("supports setting text-scale through agent command", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_text_scale",
      textScale: "small",
    });

    const state = getAgentReaderState(runtime);
    expect(state.textScale).toBe("small");
  });

  it("supports summarize-then-read through agent API", async () => {
    const runtime = createAgentReaderRuntime(words(), 320);

    const summarizedRuntime = await executeAgentSummarizeCommand(
      runtime,
      {
        preset: "short",
        sourceLabel: "stdin",
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => "first summary sentence second summary sentence"
    );

    const state = getAgentReaderState(summarizedRuntime);
    expect(state.currentIndex).toBe(0);
    expect(state.currentWpm).toBe(320);
    expect(state.summaryEnabled).toBe(true);
    expect(state.summaryPreset).toBe("short");
    expect(state.summaryProvider).toBe("openai");
    expect(state.summarySourceLabel).toBe("stdin (summary:short)");
    expect(state.readingMode).toBe("rsvp");
    expect(state.totalWords).toBeGreaterThan(3);
  });

  it("supports URL ingest through agent API with runtime defaults/overrides", async () => {
    const result = await executeAgentIngestUrlCommand(
      {
        url: "https://example.com/article",
        initialWpm: 420,
        textScale: "large",
        readingMode: "scroll",
        readUrlOptions: {
          timeoutMs: 25,
        },
      },
      async (url, options) => {
        expect(url).toBe("https://example.com/article");
        expect(options?.timeoutMs).toBe(25);
        return {
          content: "alpha beta gamma",
          source: "Mock Article",
          wordCount: 3,
        };
      }
    );

    const state = getAgentReaderState(result.runtime);
    expect(result.sourceLabel).toBe("Mock Article");
    expect(result.wordCount).toBe(3);
    expect(state.currentWpm).toBe(420);
    expect(state.textScale).toBe("large");
    expect(state.readingMode).toBe("scroll");
    expect(state.totalWords).toBe(3);
  });

  it("supports file ingest through agent API with runtime defaults/overrides", async () => {
    const result = await executeAgentIngestFileCommand(
      {
        path: "tests/fixtures/sample.pdf",
        initialWpm: 410,
        textScale: "small",
        readingMode: "chunked",
      },
      async (path: string) => {
        expect(path).toBe("tests/fixtures/sample.pdf");
        return {
          content: "alpha beta gamma delta",
          source: "sample.pdf",
          wordCount: 4,
        };
      }
    );

    const state = getAgentReaderState(result.runtime);
    expect(result.sourceLabel).toBe("sample.pdf");
    expect(result.wordCount).toBe(4);
    expect(state.currentWpm).toBe(410);
    expect(state.textScale).toBe("small");
    expect(state.readingMode).toBe("chunked");
  });

  it("supports EPUB file ingest through agent API", async () => {
    const result = await executeAgentIngestFileCommand(
      {
        path: "tests/fixtures/sample.epub",
      },
      async (path: string) => {
        expect(path).toBe("tests/fixtures/sample.epub");
        return {
          content: "chapter one chapter two",
          source: "sample.epub",
          wordCount: 4,
        };
      }
    );

    expect(result.sourceLabel).toBe("sample.epub");
    expect(result.wordCount).toBe(4);
  });

  it("fails closed for invalid mode payload in ingest_file command", async () => {
    let readFileCalls = 0;

    await expect(
      executeAgentIngestFileCommand(
        {
          path: "tests/fixtures/sample.pdf",
          readingMode: "warp" as unknown as "rsvp",
        },
        async () => {
          readFileCalls += 1;
          return {
            content: "should not run",
            source: "Nope",
            wordCount: 3,
          };
        }
      )
    ).rejects.toThrow("Invalid readingMode");

    expect(readFileCalls).toBe(0);
  });

  it("maps missing file ingest failures to stable agent error code", async () => {
    await expect(
      executeAgentIngestFileCommand(
        {
          path: "tests/fixtures/missing.pdf",
        },
        async () => {
          throw new Error("File not found");
        }
      )
    ).rejects.toMatchObject({
      name: "AgentIngestFileError",
      code: "FILE_NOT_FOUND",
      message: "File not found",
    } satisfies Partial<AgentIngestFileError>);
  });

  it("maps known PDF ingest failures to stable agent error codes", async () => {
    const cases = [
      {
        error: new Error("Invalid or corrupted PDF file"),
        code: "PDF_INVALID",
      },
      {
        error: new Error("PDF is encrypted or password-protected"),
        code: "PDF_ENCRYPTED",
      },
      {
        error: new Error("PDF has no extractable text"),
        code: "PDF_EMPTY_TEXT",
      },
      {
        error: new Error("Input exceeds maximum supported size"),
        code: "INPUT_TOO_LARGE",
      },
      {
        error: new Error("PDF parsing timed out"),
        code: "PDF_PARSE_FAILED",
      },
    ] as const;

    for (const entry of cases) {
      await expect(
        executeAgentIngestFileCommand(
          {
            path: "tests/fixtures/sample.pdf",
          },
          async () => {
            throw entry.error;
          }
        )
      ).rejects.toMatchObject({
        name: "AgentIngestFileError",
        code: entry.code,
      });
    }
  });

  it("maps known EPUB ingest failures to stable agent error codes", async () => {
    const cases = [
      {
        error: new Error("Invalid or corrupted EPUB file"),
        code: "EPUB_INVALID",
      },
      {
        error: new Error("EPUB is encrypted or DRM-protected"),
        code: "EPUB_ENCRYPTED",
      },
      {
        error: new Error("EPUB has no extractable text"),
        code: "EPUB_EMPTY_TEXT",
      },
      {
        error: new Error("EPUB parsing timed out"),
        code: "EPUB_PARSE_FAILED",
      },
    ] as const;

    for (const entry of cases) {
      await expect(
        executeAgentIngestFileCommand(
          {
            path: "tests/fixtures/sample.epub",
          },
          async () => {
            throw entry.error;
          }
        )
      ).rejects.toMatchObject({
        name: "AgentIngestFileError",
        code: entry.code,
      });
    }
  });

  it("normalizes unknown ingest failures to deterministic parse error class", async () => {
    await expect(
      executeAgentIngestFileCommand(
        {
          path: "tests/fixtures/sample.pdf",
        },
        async () => {
          throw new Error("native parser panic");
        }
      )
    ).rejects.toMatchObject({
      name: "AgentIngestFileError",
      code: "PDF_PARSE_FAILED",
      message: "Failed to parse PDF file",
    } satisfies Partial<AgentIngestFileError>);

    await expect(
      executeAgentIngestFileCommand(
        {
          path: "tests/fixtures/sample.epub",
        },
        async () => {
          throw new Error("unexpected epub parser panic");
        }
      )
    ).rejects.toMatchObject({
      name: "AgentIngestFileError",
      code: "EPUB_PARSE_FAILED",
      message: "Failed to parse EPUB file",
    } satisfies Partial<AgentIngestFileError>);

    await expect(
      executeAgentIngestFileCommand(
        {
          path: "tests/fixtures/sample.pdf",
        },
        async () => {
          throw "stringy failure";
        }
      )
    ).rejects.toMatchObject({
      name: "AgentIngestFileError",
      code: "PDF_PARSE_FAILED",
      message: "Failed to parse PDF file",
    } satisfies Partial<AgentIngestFileError>);
  });

  it("fails closed for invalid mode payload in ingest_url command", async () => {
    let readUrlCalls = 0;

    await expect(
      executeAgentIngestUrlCommand(
        {
          url: "https://example.com/article",
          readingMode: "warp" as unknown as "rsvp",
        },
        async () => {
          readUrlCalls += 1;
          return {
            content: "should not run",
            source: "Nope",
            wordCount: 3,
          };
        }
      )
    ).rejects.toThrow("Invalid readingMode");

    expect(readUrlCalls).toBe(0);
  });

  it("supports switching to chunked reading mode through agent command", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "chunked",
    });

    const state = getAgentReaderState(runtime);
    expect(state.readingMode).toBe("chunked");
    expect(state.totalWords).toBeLessThanOrEqual(2);
  });

  it("supports summarize + chunked parity through agent API", async () => {
    const runtime = createAgentReaderRuntime(words(), 320);

    const summarizedRuntime = await executeAgentSummarizeCommand(
      runtime,
      {
        preset: "medium",
        sourceLabel: "stdin",
        readingMode: "chunked",
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => "alpha beta gamma, delta epsilon zeta. eta theta iota"
    );

    const state = getAgentReaderState(summarizedRuntime);
    expect(state.readingMode).toBe("chunked");
    expect(state.summarySourceLabel).toContain("[chunked]");
    expect(state.totalWords).toBeLessThan(9);
  });

  it("supports switching to bionic reading mode through agent command", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "bionic",
    });

    const state = getAgentReaderState(runtime);
    expect(state.readingMode).toBe("bionic");
    expect(state.currentWord).toBe("first");
  });

  it("supports summarize + bionic parity through agent API", async () => {
    const runtime = createAgentReaderRuntime(words(), 320);

    const summarizedRuntime = await executeAgentSummarizeCommand(
      runtime,
      {
        preset: "medium",
        sourceLabel: "stdin",
        readingMode: "bionic",
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => "alpha beta gamma, delta epsilon zeta. eta theta iota"
    );

    const state = getAgentReaderState(summarizedRuntime);
    expect(state.readingMode).toBe("bionic");
    expect(state.summarySourceLabel).toContain("[bionic]");
    expect(state.currentWord).toBe("alpha");
    expect(state.totalWords).toBe(9);
  });

  it("fails closed for invalid mode payload in set_reading_mode command", () => {
    const runtime = createAgentReaderRuntime(words(), 300);

    expect(() =>
      executeAgentCommand(runtime, {
        type: "set_reading_mode",
        readingMode: "\u001b[31mchunked" as unknown as "rsvp",
      })
    ).toThrow("Invalid readingMode");
  });

  it("fails closed for invalid summarize readingMode before summarization", async () => {
    const runtime = createAgentReaderRuntime(words(), 300);
    let summarizeCalls = 0;

    await expect(
      executeAgentSummarizeCommand(
        runtime,
        {
          preset: "short",
          sourceLabel: "stdin",
          readingMode: "warp" as unknown as "rsvp",
          llmConfig: {
            provider: "openai",
            model: "gpt-5-mini",
            apiKey: "test",
            timeoutMs: 1_000,
            maxRetries: 0,
          },
        },
        async () => {
          summarizeCalls += 1;
          return "should not run";
        }
      )
    ).rejects.toThrow("Invalid readingMode");

    expect(summarizeCalls).toBe(0);
  });

  it("reuses cached transformed words when switching back to bionic mode", () => {
    let runtime = createAgentReaderRuntime(words(), 300);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "bionic",
    });
    const firstBionicWords = runtime.reader.words;

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "rsvp",
    });

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "bionic",
    });

    expect(runtime.reader.words).toBe(firstBionicWords);
  });

  it("preserves session accounting when switching modes through the agent API", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = {
      ...runtime,
      reader: {
        ...runtime.reader,
        currentIndex: 1,
        state: "playing",
      },
      session: {
        ...runtime.session,
        startTimeMs: 1_000,
        lastPlayStartMs: 1_000,
        wordsRead: 1,
      },
    };

    runtime = executeAgentCommand(
      runtime,
      {
        type: "set_reading_mode",
        readingMode: "chunked",
      },
      1_500
    );

    expect(runtime.session.wordsRead).toBe(1);
    expect(runtime.session.totalReadingTimeMs).toBe(500);
    expect(runtime.reader.state).toBe("paused");
  });

  it("treats same-mode agent switches as a no-op", () => {
    const runtime = createAgentReaderRuntime(words(), 300, "normal", "scroll");

    expect(
      executeAgentCommand(runtime, {
        type: "set_reading_mode",
        readingMode: "scroll",
      })
    ).toBe(runtime);
  });

  it("resets mode cache when source corpus changes via summarize", async () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "bionic",
    });
    const oldBionicWords = runtime.reader.words;

    runtime = await executeAgentSummarizeCommand(
      runtime,
      {
        preset: "medium",
        sourceLabel: "stdin",
        readingMode: "bionic",
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => "new summary content only"
    );

    expect(runtime.reader.words).not.toBe(oldBionicWords);

    const firstSummaryBionicWords = runtime.reader.words;
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "rsvp",
    });
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "bionic",
    });

    expect(runtime.reader.words).toBe(firstSummaryBionicWords);
  });
});
