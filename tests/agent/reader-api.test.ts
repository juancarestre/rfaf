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
