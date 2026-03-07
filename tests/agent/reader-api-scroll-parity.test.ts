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

  it("supports line-step commands in scroll mode", () => {
    let runtime = createAgentReaderRuntime(
      [
        { text: "alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
        { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "epsilon", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "zeta", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "eta", index: 6, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "theta", index: 7, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "iota", index: 8, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "averyveryverylongword", index: 9, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
        { text: "kappa", index: 10, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      ],
      300,
      "normal",
      "scroll"
    );

    runtime = executeAgentCommand(runtime, { type: "step_next_line" });
    expect(getAgentReaderState(runtime).currentIndex).toBeGreaterThan(0);

    runtime = executeAgentCommand(runtime, { type: "step_prev_line" });
    expect(getAgentReaderState(runtime).currentIndex).toBe(0);
  });

  it("accepts viewport content width for line-step parity", () => {
    const words = [
      { text: "alpha", index: 0, paragraphIndex: 0, isParagraphStart: true, trailingPunctuation: null },
      { text: "beta", index: 1, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "gamma", index: 2, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "delta", index: 3, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "epsilon", index: 4, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
      { text: "zeta", index: 5, paragraphIndex: 0, isParagraphStart: false, trailingPunctuation: null },
    ] satisfies Word[];

    const narrow = executeAgentCommand(
      createAgentReaderRuntime(words, 300, "normal", "scroll"),
      { type: "step_next_line", contentWidth: 10 }
    );
    const wide = executeAgentCommand(
      createAgentReaderRuntime(words, 300, "normal", "scroll"),
      { type: "step_next_line", contentWidth: 80 }
    );

    expect(getAgentReaderState(narrow).currentIndex).toBeLessThan(
      getAgentReaderState(wide).currentIndex
    );
  });

  it("reuses cached line maps across repeated line-step commands", () => {
    let runtime = createAgentReaderRuntime(words(), 300, "normal", "scroll");

    runtime = executeAgentCommand(runtime, { type: "step_next_line", contentWidth: 20 });
    const firstLineMapCache = runtime.lineMapCache;

    runtime = executeAgentCommand(runtime, { type: "step_prev_line", contentWidth: 20 });

    expect(runtime.lineMapCache).toBe(firstLineMapCache);

    runtime = executeAgentCommand(runtime, {
      type: "set_reading_mode",
      readingMode: "chunked",
    });

    expect(runtime.lineMapCache).toBeNull();
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
