import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createReader } from "../../src/engine/reader";
import { applyReaderAndSession } from "../../src/engine/reader-session-sync";
import { createSession, markPlayStarted } from "../../src/engine/session";
import { readHistoryRecords } from "../../src/history/history-store";
import { persistCompletedSessionTransition } from "../../src/history/history-runtime";
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

describe("history completion integration", () => {
  it("persists exactly once on completion transition", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-complete-"));
    const historyPath = join(dir, "history.json");
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const nextReader = { ...currentReader, state: "finished" as const, currentIndex: 1 };
    const currentSession = markPlayStarted(createSession(300), 0);
    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 30_000);

    expect(
      persistCompletedSessionTransition({
        historyPath,
        currentReader,
        nextReader,
        nextSession,
        mode: "rsvp",
        sourceLabel: "~/notes/test.md",
      })
    ).toBe(true);

    expect(readHistoryRecords(historyPath)).toHaveLength(1);
  });

  it("does not persist non-completion transitions", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-paused-"));
    const historyPath = join(dir, "history.json");
    const words = makeWords();
    const currentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const nextReader = { ...currentReader, state: "paused" as const };
    const currentSession = markPlayStarted(createSession(300), 0);
    const nextSession = applyReaderAndSession(currentReader, currentSession, nextReader, 1_000);

    expect(
      persistCompletedSessionTransition({
        historyPath,
        currentReader,
        nextReader,
        nextSession,
        mode: "rsvp",
        sourceLabel: "~/notes/test.md",
      })
    ).toBe(false);

    expect(readHistoryRecords(historyPath)).toEqual([]);
  });

  it("does not double-write on finished -> finished no-op", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-noop-"));
    const historyPath = join(dir, "history.json");
    const words = makeWords();

    const firstCurrentReader = { ...createReader(words, 300), state: "playing" as const, currentIndex: 0 };
    const firstNextReader = { ...firstCurrentReader, state: "finished" as const, currentIndex: 1 };
    const firstSession = applyReaderAndSession(
      firstCurrentReader,
      markPlayStarted(createSession(300), 0),
      firstNextReader,
      30_000
    );

    persistCompletedSessionTransition({
      historyPath,
      currentReader: firstCurrentReader,
      nextReader: firstNextReader,
      nextSession: firstSession,
      mode: "rsvp",
      sourceLabel: "~/notes/test.md",
    });

    persistCompletedSessionTransition({
      historyPath,
      currentReader: firstNextReader,
      nextReader: firstNextReader,
      nextSession: firstSession,
      mode: "rsvp",
      sourceLabel: "~/notes/test.md",
    });

    expect(readHistoryRecords(historyPath)).toHaveLength(1);
  });
});
