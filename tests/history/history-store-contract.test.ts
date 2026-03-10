import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendHistoryRecord,
  readHistoryRecords,
  writeHistoryRecords,
} from "../../src/history/history-store";
import { createHistorySessionRecord } from "../../src/history/session-record";

describe("history store contract", () => {
  it("persists exactly one record per append in deterministic order", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-store-"));
    const historyPath = join(dir, "history.json");

    const first = createHistorySessionRecord({
      session: {
        startTimeMs: 1,
        lastPlayStartMs: null,
        totalReadingTimeMs: 60_000,
        wordsRead: 300,
        currentWpm: 300,
        averageWpm: 0,
        finishedAtMs: 1_000,
      },
      mode: "rsvp",
      sourceLabel: "~/docs/one.md",
    });

    const second = createHistorySessionRecord({
      session: {
        startTimeMs: 2,
        lastPlayStartMs: null,
        totalReadingTimeMs: 30_000,
        wordsRead: 120,
        currentWpm: 240,
        averageWpm: 0,
        finishedAtMs: 2_000,
      },
      mode: "chunked",
      sourceLabel: "https://example.com",
    });

    appendHistoryRecord(historyPath, first);
    appendHistoryRecord(historyPath, second);

    expect(readHistoryRecords(historyPath)).toEqual([first, second]);
  });

  it("writes only the whitelisted schema fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-schema-"));
    const historyPath = join(dir, "history.json");

    writeHistoryRecords(historyPath, [
      {
        finishedAtMs: 1_000,
        durationMs: 10_000,
        durationSeconds: 10,
        wordsRead: 50,
        averageWpm: 300,
        mode: "rsvp",
        sourceLabel: "source",
      },
    ]);

    const firstLine = readFileSync(historyPath, "utf8").trim().split(/\r?\n/)[0] ?? "{}";
    const parsed = JSON.parse(firstLine) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();

    expect(keys).toEqual([
      "averageWpm",
      "durationMs",
      "durationSeconds",
      "finishedAtMs",
      "mode",
      "sourceLabel",
      "wordsRead",
    ]);
  });

  it("appends safely when existing storage is legacy JSON array", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-legacy-"));
    const historyPath = join(dir, "history.json");

    writeFileSync(
      historyPath,
      JSON.stringify([
        {
          finishedAtMs: 1_000,
          durationMs: 10_000,
          durationSeconds: 10,
          wordsRead: 50,
          averageWpm: 300,
          mode: "rsvp",
          sourceLabel: "legacy",
        },
      ])
    );

    appendHistoryRecord(historyPath, {
      finishedAtMs: 2_000,
      durationMs: 20_000,
      durationSeconds: 20,
      wordsRead: 70,
      averageWpm: 210,
      mode: "chunked",
      sourceLabel: "new",
    });

    const records = readHistoryRecords(historyPath);
    expect(records).toHaveLength(2);
    expect(records[0]?.sourceLabel).toBe("legacy");
    expect(records[1]?.sourceLabel).toBe("new");
  });
});
