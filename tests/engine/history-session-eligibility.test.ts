import { describe, expect, it } from "bun:test";
import { createReader } from "../../src/engine/reader";
import { applyReaderAndSession } from "../../src/engine/reader-session-sync";
import { createSession, markPlayStarted } from "../../src/engine/session";
import { shouldPersistCompletedSession } from "../../src/history/session-record";
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
  ];
}

describe("history session eligibility", () => {
  it("persists only on unfinished -> finished transition", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const nextReader = { ...currentReader, state: "finished" as const, currentIndex: 1 };
    const currentSession = markPlayStarted(createSession(300), 0);
    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 30_000);

    expect(shouldPersistCompletedSession(currentReader, nextReader, nextSession)).toBe(true);
  });

  it("does not persist paused/aborted transitions", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const nextReader = { ...currentReader, state: "paused" as const };
    const currentSession = markPlayStarted(createSession(300), 0);
    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 3_000);

    expect(shouldPersistCompletedSession(currentReader, nextReader, nextSession)).toBe(false);
  });

  it("does not persist finished -> finished no-op transitions", () => {
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "finished" as const, currentIndex: 1 };
    const nextReader = { ...currentReader };
    const currentSession = {
      ...createSession(300),
      finishedAtMs: 10_000,
      wordsRead: 1,
      totalReadingTimeMs: 10_000,
      averageWpm: 6,
    };

    expect(shouldPersistCompletedSession(currentReader, nextReader, currentSession)).toBe(false);
  });
});
