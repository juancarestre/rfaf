export interface Session {
  startTimeMs: number | null;
  lastPlayStartMs: number | null;
  totalReadingTimeMs: number;
  wordsRead: number;
  currentWpm: number;
  averageWpm: number;
  finishedAtMs: number | null;
}

export function createSession(initialWpm: number): Session {
  return {
    startTimeMs: null,
    lastPlayStartMs: null,
    totalReadingTimeMs: 0,
    wordsRead: 0,
    currentWpm: initialWpm,
    averageWpm: 0,
    finishedAtMs: null,
  };
}

export function markPlayStarted(session: Session, nowMs: number): Session {
  return {
    ...session,
    startTimeMs: session.startTimeMs ?? nowMs,
    lastPlayStartMs: nowMs,
  };
}

export function markPaused(session: Session, nowMs: number): Session {
  if (session.lastPlayStartMs === null) {
    return session;
  }

  return {
    ...session,
    totalReadingTimeMs:
      session.totalReadingTimeMs + (nowMs - session.lastPlayStartMs),
    lastPlayStartMs: null,
  };
}

export function markWordAdvanced(session: Session): Session {
  return { ...session, wordsRead: session.wordsRead + 1 };
}

export function finishSession(session: Session, nowMs: number): Session {
  const paused = markPaused(session, nowMs);
  const minutes = paused.totalReadingTimeMs / 60_000;
  const averageWpm = minutes > 0 ? paused.wordsRead / minutes : 0;

  return {
    ...paused,
    averageWpm: Math.round(averageWpm),
    finishedAtMs: nowMs,
  };
}
