import { describe, expect, it } from "bun:test";
import { markPlayStarted, markWordAdvanced } from "../../src/engine/session";
import type { Word } from "../../src/processor/types";
import {
  createAppRuntimeState,
  getReadingModeForInput,
  switchAppReadingMode,
} from "../../src/ui/runtime-mode-state";

function makeWords(): Word[] {
  return [
    {
      text: "alpha",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "beta",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "gamma",
      index: 2,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "clause_break",
    },
    {
      text: "delta",
      index: 3,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "epsilon",
      index: 4,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "sentence_end",
    },
  ];
}

describe("App mode switching", () => {
  it("maps mode keys 1-4 and ignores other numeric inputs", () => {
    expect(getReadingModeForInput("1")).toBe("rsvp");
    expect(getReadingModeForInput("2")).toBe("chunked");
    expect(getReadingModeForInput("3")).toBe("bionic");
    expect(getReadingModeForInput("4")).toBe("scroll");
    expect(getReadingModeForInput("5")).toBeNull();
    expect(getReadingModeForInput("9")).toBeNull();
  });

  it("switches modes, pauses playback, and preserves position approximately", () => {
    const sourceWords = makeWords();
    const runtime = createAppRuntimeState(sourceWords, "rsvp", 300);
    const playingRuntime = {
      ...runtime,
      reader: { ...runtime.reader, currentIndex: 2, state: "playing" as const },
    };

    const nextRuntime = switchAppReadingMode(playingRuntime, sourceWords, "chunked", 1_000);

    expect(nextRuntime.activeMode).toBe("chunked");
    expect(nextRuntime.reader.state).toBe("paused");
    expect(nextRuntime.reader.currentIndex).toBe(0);
    expect(nextRuntime.reader.currentWpm).toBe(300);
  });

  it("is a no-op when re-selecting the active mode", () => {
    const sourceWords = makeWords();
    const runtime = createAppRuntimeState(sourceWords, "bionic", 300);

    expect(switchAppReadingMode(runtime, sourceWords, "bionic", 1_000)).toBe(runtime);
  });

  it("preserves finished state and clamps to the last target index", () => {
    const sourceWords = makeWords();
    const runtime = createAppRuntimeState(sourceWords, "rsvp", 300);
    const finishedRuntime = {
      ...runtime,
      reader: {
        ...runtime.reader,
        currentIndex: sourceWords.length - 1,
        state: "finished" as const,
      },
    };

    const nextRuntime = switchAppReadingMode(finishedRuntime, sourceWords, "chunked", 1_000);

    expect(nextRuntime.reader.state).toBe("finished");
    expect(nextRuntime.reader.currentIndex).toBe(nextRuntime.reader.words.length - 1);
  });

  it("keeps session continuity without counting mode remapping as additional words read", () => {
    const sourceWords = makeWords();
    const runtime = createAppRuntimeState(sourceWords, "rsvp", 300);
    const startedSession = markWordAdvanced(
      markWordAdvanced(markPlayStarted(runtime.session, 500))
    );
    const playingRuntime = {
      ...runtime,
      reader: { ...runtime.reader, currentIndex: 2, state: "playing" as const },
      session: startedSession,
    };

    const nextRuntime = switchAppReadingMode(playingRuntime, sourceWords, "scroll", 1_000);

    expect(nextRuntime.session).not.toBe(runtime.session);
    expect(nextRuntime.session.wordsRead).toBe(2);
    expect(nextRuntime.session.totalReadingTimeMs).toBe(500);
  });

  it("reuses cached transformed words when switching back to a visited mode", () => {
    const sourceWords = makeWords();
    const first = switchAppReadingMode(
      createAppRuntimeState(sourceWords, "rsvp", 300),
      sourceWords,
      "bionic",
      1_000
    );
    const firstBionicWords = first.reader.words;

    const second = switchAppReadingMode(first, sourceWords, "scroll", 1_100);
    const third = switchAppReadingMode(second, sourceWords, "bionic", 1_200);

    expect(third.reader.words).toBe(firstBionicWords);
  });

  it("handles single-word source content without dividing by zero", () => {
    const sourceWords = [makeWords()[0]!];
    const runtime = createAppRuntimeState(sourceWords, "rsvp", 300);

    const nextRuntime = switchAppReadingMode(runtime, sourceWords, "scroll", 1_000);

    expect(nextRuntime.reader.currentIndex).toBe(0);
    expect(nextRuntime.reader.state).toBe("paused");
  });
});
