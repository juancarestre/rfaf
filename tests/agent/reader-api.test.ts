import { describe, expect, it } from "bun:test";
import {
  createAgentReaderRuntime,
  executeAgentCommand,
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
    expect(state.totalWords).toBe(3);
    expect(state.progress).toBe(0);
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
});
