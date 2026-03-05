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
    expect(state.totalWords).toBeGreaterThan(3);
  });
});
