import type { ReadingMode } from "../cli/mode-option";
import type { Reader } from "../engine/reader";
import type { Session } from "../engine/session";
import { appendHistoryRecord } from "./history-store";
import { createHistorySessionRecord, shouldPersistCompletedSession } from "./session-record";

interface PersistCompletedSessionTransitionInput {
  historyPath: string;
  currentReader: Reader;
  nextReader: Reader;
  nextSession: Session;
  mode: ReadingMode;
  sourceLabel: string;
}

export function persistCompletedSessionTransition(
  input: PersistCompletedSessionTransitionInput
): boolean {
  if (!shouldPersistCompletedSession(input.currentReader, input.nextReader, input.nextSession)) {
    return false;
  }

  appendHistoryRecord(
    input.historyPath,
    createHistorySessionRecord({
      session: input.nextSession,
      mode: input.mode,
      sourceLabel: input.sourceLabel,
    })
  );

  return true;
}
