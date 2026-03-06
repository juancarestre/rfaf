import { describe, expect, it } from "bun:test";
import {
  createAgentReaderRuntime,
  executeAgentCommand,
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

describe("agent reader API scroll parity", () => {
  it("supports switching to scroll reading mode via set_reading_mode", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });

    const state = getAgentReaderState(runtime);
    expect(state.readingMode).toBe("scroll");
  });

  it("applies pass-through transform for scroll (words unchanged)", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });

    const state = getAgentReaderState(runtime);
    // scroll is pass-through: word count stays the same as source
    expect(state.totalWords).toBe(3);
    expect(state.currentWord).toBe("first");
  });

  it("preserves progress ratio when switching to scroll", () => {
    let runtime = createAgentReaderRuntime(words(), 300);
    // Advance to middle
    runtime = executeAgentCommand(runtime, { type: "step_next" });
    expect(getAgentReaderState(runtime).currentIndex).toBe(1);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });

    const state = getAgentReaderState(runtime);
    expect(state.readingMode).toBe("scroll");
    expect(state.currentIndex).toBe(1);
  });

  it("supports round-trip: rsvp -> scroll -> rsvp", () => {
    let runtime = createAgentReaderRuntime(words(), 300);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });
    expect(getAgentReaderState(runtime).readingMode).toBe("scroll");

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "rsvp",
    });
    expect(getAgentReaderState(runtime).readingMode).toBe("rsvp");
    expect(getAgentReaderState(runtime).totalWords).toBe(3);
  });

  it("supports round-trip: chunked -> scroll -> chunked", () => {
    let runtime = createAgentReaderRuntime(words(), 300);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "chunked",
    });
    const chunkedWordCount = getAgentReaderState(runtime).totalWords;

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });
    expect(getAgentReaderState(runtime).totalWords).toBe(3);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "chunked",
    });
    expect(getAgentReaderState(runtime).totalWords).toBe(chunkedWordCount);
  });

  it("creates runtime directly in scroll mode", () => {
    const runtime = createAgentReaderRuntime(words(), 300, "normal", "scroll");
    const state = getAgentReaderState(runtime);

    expect(state.readingMode).toBe("scroll");
    expect(state.totalWords).toBe(3);
    expect(state.currentWord).toBe("first");
  });

  it("supports summarize + scroll parity through agent API", async () => {
    const runtime = createAgentReaderRuntime(words(), 320);

    const summarizedRuntime = await executeAgentSummarizeCommand(
      runtime,
      {
        preset: "medium",
        sourceLabel: "stdin",
        readingMode: "scroll",
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
    expect(state.readingMode).toBe("scroll");
    expect(state.summarySourceLabel).toContain("[scroll]");
    expect(state.totalWords).toBe(9);
  });

  it("reuses cached scroll words when switching back", () => {
    let runtime = createAgentReaderRuntime(words(), 300);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });
    const firstScrollWords = runtime.reader.words;

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "chunked",
    });

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "scroll",
    });

    expect(runtime.reader.words).toBe(firstScrollWords);
  });
});
