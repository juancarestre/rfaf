import type { ReadingMode } from "../cli/mode-option";
import type { Reader } from "../engine/reader";
import type { Session } from "../engine/session";
import { sanitizeTerminalText } from "../terminal/sanitize-terminal-text";

export const MAX_HISTORY_SOURCE_LABEL_LENGTH = 120;

export interface HistoryMetrics {
  durationMs: number;
  durationSeconds: number;
  wordsRead: number;
  averageWpm: number;
}

export interface HistorySessionRecord extends HistoryMetrics {
  finishedAtMs: number;
  mode: ReadingMode;
  sourceLabel: string;
}

function truncateWithAsciiEllipsis(value: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

const TRANSFORM_SUFFIX_PATTERN = /\s+\((summary:[^)]+|translated:[^)]+|no-bs|key-phrases)\)$/;

function splitKnownTransformSuffix(value: string): { base: string; suffix: string } {
  const match = value.match(TRANSFORM_SUFFIX_PATTERN);
  if (!match || match.index === undefined) {
    return { base: value, suffix: "" };
  }

  return {
    base: value.slice(0, match.index),
    suffix: match[0],
  };
}

function normalizeUrlLabel(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastPathSegment = segments.length > 0 ? segments[segments.length - 1] : "";
    return lastPathSegment ? `${parsed.hostname}/${lastPathSegment}` : parsed.hostname;
  } catch {
    return null;
  }
}

function normalizePathLabel(value: string): string | null {
  const looksLikePath =
    value.startsWith("/") ||
    value.startsWith("~/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("/") ||
    value.includes("\\");

  if (!looksLikePath) {
    return null;
  }

  const normalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  return segments[segments.length - 1] ?? null;
}

export function sanitizeHistorySourceLabel(rawSourceLabel: string): string {
  const safeLabel = sanitizeTerminalText(rawSourceLabel)
    .replace(/\s+/g, " ")
    .trim();

  if (safeLabel.length === 0) return "Unknown source";

  const { base, suffix } = splitKnownTransformSuffix(safeLabel);
  const normalizedBase = normalizeUrlLabel(base) ?? normalizePathLabel(base) ?? base;
  const normalized = `${normalizedBase}${suffix}`.trim();

  if (normalized.length === 0) return "Unknown source";
  return truncateWithAsciiEllipsis(normalized, MAX_HISTORY_SOURCE_LABEL_LENGTH);
}

export function shouldPersistCompletedSession(
  currentReader: Reader,
  nextReader: Reader,
  nextSession: Session
): boolean {
  return (
    currentReader.state !== "finished" &&
    nextReader.state === "finished" &&
    nextSession.finishedAtMs !== null
  );
}

export function deriveHistoryMetrics(session: Session): HistoryMetrics {
  const durationMs = Math.max(0, session.totalReadingTimeMs);
  const durationMinutes = durationMs / 60_000;
  const averageWpm = durationMinutes > 0 ? Math.round(session.wordsRead / durationMinutes) : 0;

  return {
    durationMs,
    durationSeconds: Math.floor(durationMs / 1000),
    wordsRead: Math.max(0, session.wordsRead),
    averageWpm,
  };
}

export function createHistorySessionRecord(input: {
  session: Session;
  sourceLabel: string;
  mode: ReadingMode;
}): HistorySessionRecord {
  if (input.session.finishedAtMs === null) {
    throw new Error("Cannot create history record for unfinished session.");
  }

  return {
    ...deriveHistoryMetrics(input.session),
    finishedAtMs: input.session.finishedAtMs,
    mode: input.mode,
    sourceLabel: sanitizeHistorySourceLabel(input.sourceLabel),
  };
}
