import { describe, expect, it } from "bun:test";
import { createReader } from "../../src/engine/reader";
import { applyReaderAndSession } from "../../src/engine/reader-session-sync";
import { createSession, finishSession, markPaused, markPlayStarted, markWordAdvanced } from "../../src/engine/session";
import type { Word } from "../../src/processor/types";

function makeWords(): Word[] {
  return [
    {
      text: "one",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "two",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "three",
      index: 2,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "sentence_end",
    },
  ];
}

describe("applyReaderAndSession", () => {
  it("marks session play start when reader starts playing", () => {
    const currentReader = createReader(makeWords(), 300);
    const nextReader = { ...currentReader, state: "playing" as const };
    const currentSession = createSession(300);

    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 1_000);

    expect(nextSession.startTimeMs).toBe(1_000);
    expect(nextSession.lastPlayStartMs).toBe(1_000);
  });

  it("marks session paused when reader stops playing", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const };
    const nextReader = { ...currentReader, state: "paused" as const };
    const currentSession = markPlayStarted(createSession(300), 1_000);

    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 1_600);

    expect(nextSession.totalReadingTimeMs).toBe(600);
    expect(nextSession.lastPlayStartMs).toBeNull();
  });

  it("counts advanced words while playing and syncs WPM", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const };
    const nextReader = { ...currentReader, currentIndex: 2, currentWpm: 350 };
    const currentSession = markPlayStarted(createSession(300), 0);

    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 500);

    expect(nextSession.wordsRead).toBe(2);
    expect(nextSession.currentWpm).toBe(350);
  });

  it("finishes the session when the reader finishes", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 1 };
    const nextReader = { ...currentReader, currentIndex: 2, state: "finished" as const };
    const currentSession = markPlayStarted(createSession(300), 0);

    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 60_000);

    expect(nextSession.finishedAtMs).toBe(60_000);
    expect(nextSession.totalReadingTimeMs).toBe(60_000);
    expect(nextSession.wordsRead).toBe(1);
    expect(nextSession.averageWpm).toBe(1);
  });

  it("matches the previous inline behavior used by screens", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const nextReader = { ...currentReader, currentIndex: 2, currentWpm: 325 };
    const currentSession = markPlayStarted(createSession(300), 10_000);

    const extracted = applyReaderAndSession(currentReader, currentSession, nextReader, 12_000);

    let inlined = currentSession;
    inlined = markWordAdvanced(inlined);
    inlined = markWordAdvanced(inlined);
    inlined = { ...inlined, currentWpm: 325 };

    expect(extracted).toEqual(inlined);
  });
});
