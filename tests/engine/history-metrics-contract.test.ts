import { describe, expect, it } from "bun:test";
import { deriveHistoryMetrics } from "../../src/history/session-record";
import { createSession } from "../../src/engine/session";

describe("history metrics contract", () => {
  it("derives deterministic core metrics from session timing", () => {
    const session = {
      ...createSession(300),
      wordsRead: 321,
      totalReadingTimeMs: 95_499,
      averageWpm: 999,
      finishedAtMs: 1700000000000,
    };

    const metrics = deriveHistoryMetrics(session);

    expect(metrics.wordsRead).toBe(321);
    expect(metrics.durationMs).toBe(95_499);
    expect(metrics.durationSeconds).toBe(95);
    expect(metrics.averageWpm).toBe(202);
  });

  it("returns zero WPM when duration is zero", () => {
    const session = {
      ...createSession(300),
      wordsRead: 50,
      totalReadingTimeMs: 0,
      averageWpm: 200,
      finishedAtMs: 1700000000000,
    };

    const metrics = deriveHistoryMetrics(session);
    expect(metrics.averageWpm).toBe(0);
    expect(metrics.durationSeconds).toBe(0);
  });
});
