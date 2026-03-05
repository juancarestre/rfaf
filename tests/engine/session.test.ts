import { describe, expect, it } from "bun:test";
import {
  createSession,
  markPlayStarted,
  markPaused,
  markWordAdvanced,
  finishSession,
} from "../../src/engine/session";

describe("session tracking", () => {
  it("starts with zeroed stats", () => {
    const s = createSession(300);
    expect(s.currentWpm).toBe(300);
    expect(s.wordsRead).toBe(0);
    expect(s.totalReadingTimeMs).toBe(0);
    expect(s.startTimeMs).toBeNull();
    expect(s.lastPlayStartMs).toBeNull();
  });

  it("marks play start and pause accumulates reading time", () => {
    let s = createSession(300);
    s = markPlayStarted(s, 1000);
    s = markPaused(s, 1600);
    expect(s.totalReadingTimeMs).toBe(600);
    expect(s.lastPlayStartMs).toBeNull();
  });

  it("counts words advanced", () => {
    let s = createSession(300);
    s = markWordAdvanced(s);
    s = markWordAdvanced(s);
    expect(s.wordsRead).toBe(2);
  });

  it("computes average WPM on finish", () => {
    let s = createSession(300);
    s = markPlayStarted(s, 0);
    s = markWordAdvanced(s);
    s = markWordAdvanced(s);
    s = markWordAdvanced(s);
    s = markPaused(s, 60_000); // 1 minute
    s = finishSession(s, 60_000);
    expect(s.averageWpm).toBe(3);
    expect(s.finishedAtMs).toBe(60_000);
  });
});
