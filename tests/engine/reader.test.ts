import { describe, expect, it } from "bun:test";
import {
  adjustWpm,
  advancePlayback,
  createReader,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
  restartReader,
  stepBackward,
  stepForward,
  togglePlayPause,
} from "../../src/engine/reader";
import type { Word } from "../../src/processor/types";

function makeWords(): Word[] {
  return [
    {
      text: "first",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "para",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "paragraph_break",
    },
    {
      text: "second",
      index: 2,
      paragraphIndex: 1,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "end",
      index: 3,
      paragraphIndex: 1,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
  ];
}

describe("reader state machine", () => {
  it("starts paused on first word", () => {
    const reader = createReader(makeWords(), 300);
    expect(reader.state).toBe("paused");
    expect(reader.currentIndex).toBe(0);
    expect(reader.currentWpm).toBe(300);
  });

  it("toggles paused <-> playing with Space behavior", () => {
    const reader = createReader(makeWords(), 300);
    const playing = togglePlayPause(reader);
    expect(playing.state).toBe("playing");

    const pausedAgain = togglePlayPause(playing);
    expect(pausedAgain.state).toBe("paused");
  });

  it("stepForward auto-pauses when currently playing", () => {
    const playing = togglePlayPause(createReader(makeWords(), 300));
    const stepped = stepForward(playing);
    expect(stepped.state).toBe("paused");
    expect(stepped.currentIndex).toBe(1);
  });

  it("stepBackward auto-pauses when currently playing", () => {
    let reader = createReader(makeWords(), 300);
    reader = stepForward(reader);
    const playing = togglePlayPause(reader);

    const stepped = stepBackward(playing);
    expect(stepped.state).toBe("paused");
    expect(stepped.currentIndex).toBe(0);
  });

  it("left on first word is a no-op", () => {
    const reader = createReader(makeWords(), 300);
    const stepped = stepBackward(reader);
    expect(stepped.currentIndex).toBe(0);
  });

  it("right on last word is a no-op", () => {
    let reader = createReader(makeWords(), 300);
    reader = stepForward(stepForward(stepForward(reader)));
    const stepped = stepForward(reader);
    expect(stepped.currentIndex).toBe(3);
  });

  it("jumps to next paragraph start and pauses", () => {
    const playing = togglePlayPause(createReader(makeWords(), 300));
    const jumped = jumpToNextParagraph(playing);
    expect(jumped.state).toBe("paused");
    expect(jumped.currentIndex).toBe(2);
  });

  it("next paragraph on last paragraph is a no-op", () => {
    let reader = createReader(makeWords(), 300);
    reader = jumpToNextParagraph(reader);
    const jumped = jumpToNextParagraph(reader);
    expect(jumped.currentIndex).toBe(2);
  });

  it("jumps to previous paragraph start and pauses", () => {
    let reader = createReader(makeWords(), 300);
    reader = jumpToNextParagraph(reader);
    const jumped = jumpToPreviousParagraph(togglePlayPause(reader));
    expect(jumped.state).toBe("paused");
    expect(jumped.currentIndex).toBe(0);
  });

  it("previous paragraph on first paragraph is a no-op", () => {
    const reader = createReader(makeWords(), 300);
    const jumped = jumpToPreviousParagraph(reader);
    expect(jumped.currentIndex).toBe(0);
  });

  it("clamps WPM in range 50-1500", () => {
    const reader = createReader(makeWords(), 300);
    expect(adjustWpm(reader, 25).currentWpm).toBe(325);
    expect(adjustWpm(reader, -500).currentWpm).toBe(50);
    expect(adjustWpm(reader, 2000).currentWpm).toBe(1500);
  });

  it("advancePlayback moves forward while playing", () => {
    const playing = togglePlayPause(createReader(makeWords(), 300));
    const advanced = advancePlayback(playing);
    expect(advanced.state).toBe("playing");
    expect(advanced.currentIndex).toBe(1);
  });

  it("advancePlayback stops on last word and enters finished", () => {
    let reader = createReader(makeWords(), 300);
    reader = stepForward(stepForward(reader)); // index 2
    const playing = togglePlayPause(reader);

    const finished = advancePlayback(playing); // to index 3 and finished
    expect(finished.currentIndex).toBe(3);
    expect(finished.state).toBe("finished");
  });

  it("restart returns to first word paused and keeps WPM", () => {
    let reader = createReader(makeWords(), 300);
    reader = adjustWpm(reader, 200); // 500
    reader = stepForward(stepForward(stepForward(reader)));
    reader = { ...reader, state: "finished" };

    const restarted = restartReader(reader);
    expect(restarted.currentIndex).toBe(0);
    expect(restarted.state).toBe("paused");
    expect(restarted.currentWpm).toBe(500);
  });
});
