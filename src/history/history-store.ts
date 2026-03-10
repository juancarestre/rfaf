import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { join } from "node:path";
import { READING_MODES, type ReadingMode } from "../cli/mode-option";
import { sanitizeHistorySourceLabel, type HistorySessionRecord } from "./session-record";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadingMode(value: unknown): value is ReadingMode {
  return typeof value === "string" && READING_MODES.includes(value as ReadingMode);
}

function normalizePositiveInt(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function parseRecord(value: unknown): HistorySessionRecord | null {
  if (!isObject(value)) return null;

  const finishedAtMs = normalizePositiveInt(value.finishedAtMs);
  const durationMs = normalizePositiveInt(value.durationMs);
  const durationSeconds =
    normalizePositiveInt(value.durationSeconds) ??
    (durationMs === null ? null : Math.floor(durationMs / 1000));
  const wordsRead = normalizePositiveInt(value.wordsRead);
  const averageWpm = normalizePositiveInt(value.averageWpm);

  if (
    finishedAtMs === null ||
    durationMs === null ||
    durationSeconds === null ||
    wordsRead === null ||
    averageWpm === null ||
    !isReadingMode(value.mode) ||
    typeof value.sourceLabel !== "string"
  ) {
    return null;
  }

  return {
    finishedAtMs,
    durationMs,
    durationSeconds,
    wordsRead,
    averageWpm,
    mode: value.mode,
    sourceLabel: sanitizeHistorySourceLabel(value.sourceLabel),
  };
}

function toPersistedRecord(record: HistorySessionRecord): HistorySessionRecord {
  return {
    finishedAtMs: Math.floor(record.finishedAtMs),
    durationMs: Math.floor(record.durationMs),
    durationSeconds: Math.floor(record.durationSeconds),
    wordsRead: Math.floor(record.wordsRead),
    averageWpm: Math.floor(record.averageWpm),
    mode: record.mode,
    sourceLabel: sanitizeHistorySourceLabel(record.sourceLabel),
  };
}

export function readHistoryRecords(historyPath: string): HistorySessionRecord[] {
  if (!existsSync(historyPath)) return [];

  let raw: string;
  try {
    raw = readFileSync(historyPath, "utf8");
  } catch {
    return [];
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    const records: HistorySessionRecord[] = [];
    for (const item of parsed) {
      const record = parseRecord(item);
      if (record) records.push(record);
    }
    return records;
  }

  const records: HistorySessionRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) continue;

    let parsedLine: unknown;
    try {
      parsedLine = JSON.parse(trimmedLine);
    } catch {
      continue;
    }

    const record = parseRecord(parsedLine);
    if (record) records.push(record);
  }

  return records;
}

export function writeHistoryRecords(historyPath: string, records: HistorySessionRecord[]): void {
  mkdirSync(dirname(historyPath), { recursive: true });
  const sanitized = records.map(toPersistedRecord);
  const serialized =
    sanitized.length === 0 ? "" : `${sanitized.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const tempPath = `${historyPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    writeFileSync(tempPath, serialized);
    renameSync(tempPath, historyPath);
  } finally {
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // best-effort temp cleanup
      }
    }
  }
}

export function appendHistoryRecord(historyPath: string, record: HistorySessionRecord): void {
  mkdirSync(dirname(historyPath), { recursive: true });
  const serializedRecord = `${JSON.stringify(toPersistedRecord(record))}\n`;

  if (existsSync(historyPath)) {
    const existing = readFileSync(historyPath, "utf8").trimStart();
    if (existing.startsWith("[")) {
      const records = readHistoryRecords(historyPath);
      records.push(toPersistedRecord(record));
      writeHistoryRecords(historyPath, records);
      return;
    }
  }

  appendFileSync(historyPath, serializedRecord, "utf8");
}

export function defaultHistoryPath(env: Record<string, string | undefined>): string {
  return env.RFAF_HISTORY_PATH ?? join(homedir(), ".rfaf", "history.json");
}
