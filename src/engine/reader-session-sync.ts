import type { Reader } from "./reader";
import {
  finishSession,
  markPaused,
  markPlayStarted,
  markWordAdvanced,
  type Session,
} from "./session";

export function applyReaderAndSession(
  currentReader: Reader,
  currentSession: Session,
  nextReader: Reader,
  nowMs = Date.now()
): Session {
  let nextSession = currentSession;

  if (currentReader.state !== "playing" && nextReader.state === "playing") {
    nextSession = markPlayStarted(nextSession, nowMs);
  }

  if (currentReader.state === "playing" && nextReader.state !== "playing") {
    nextSession = markPaused(nextSession, nowMs);
  }

  if (
    currentReader.state === "playing" &&
    nextReader.currentIndex > currentReader.currentIndex
  ) {
    const steps = nextReader.currentIndex - currentReader.currentIndex;
    for (let i = 0; i < steps; i++) {
      nextSession = markWordAdvanced(nextSession);
    }
  }

  if (nextSession.currentWpm !== nextReader.currentWpm) {
    nextSession = { ...nextSession, currentWpm: nextReader.currentWpm };
  }

  if (currentReader.state !== "finished" && nextReader.state === "finished") {
    nextSession = finishSession(nextSession, nowMs);
  }

  return nextSession;
}
