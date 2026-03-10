import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHistoryRecords } from "../../src/history/history-store";

describe("history store malformed records", () => {
  it("skips malformed entries and returns valid records only", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-malformed-"));
    const historyPath = join(dir, "history.json");

    writeFileSync(
      historyPath,
      JSON.stringify([
        {
          finishedAtMs: 1_000,
          durationMs: 30_000,
          durationSeconds: 30,
          wordsRead: 120,
          averageWpm: 240,
          mode: "rsvp",
          sourceLabel: "valid source",
        },
        {
          finishedAtMs: "bad",
          durationMs: 10_000,
        },
        {
          finishedAtMs: 2_000,
          durationMs: 20_000,
          durationSeconds: 20,
          wordsRead: 80,
          averageWpm: 240,
          mode: "invalid-mode",
          sourceLabel: "still invalid",
        },
      ])
    );

    const records = readHistoryRecords(historyPath);
    expect(records).toHaveLength(1);
    expect(records[0]?.finishedAtMs).toBe(1_000);
  });

  it("returns empty list when file is missing or not parseable", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-history-parse-"));
    const missingPath = join(dir, "does-not-exist.json");
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "not json");

    expect(readHistoryRecords(missingPath)).toEqual([]);
    expect(readHistoryRecords(badPath)).toEqual([]);
  });
});
