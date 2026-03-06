import type { ReadingMode } from "../cli/mode-option";
import { createReader, type Reader } from "../engine/reader";
import { mapPositionToNewWords } from "../engine/position-mapping";
import { createSession, markPaused, type Session } from "../engine/session";
import { getWordsForMode, type ModeWordCache } from "../processor/mode-transform";
import type { Word } from "../processor/types";

export interface AppRuntimeState {
  activeMode: ReadingMode;
  reader: Reader;
  session: Session;
  modeWordCache: ModeWordCache;
  helpVisible: boolean;
}

export function createAppRuntimeState(
  sourceWords: Word[],
  initialMode: ReadingMode,
  initialWpm: number
): AppRuntimeState {
  const { words, modeWordCache } = getWordsForMode(sourceWords, initialMode, {
    rsvp: sourceWords,
  });

  return {
    activeMode: initialMode,
    reader: createReader(words, initialWpm),
    session: createSession(initialWpm),
    modeWordCache,
    helpVisible: false,
  };
}

export function getReadingModeForInput(input: string): ReadingMode | null {
  switch (input) {
    case "1":
      return "rsvp";
    case "2":
      return "chunked";
    case "3":
      return "bionic";
    case "4":
      return "scroll";
    default:
      return null;
  }
}

export function switchAppReadingMode(
  runtime: AppRuntimeState,
  sourceWords: Word[],
  nextMode: ReadingMode,
  nowMs = Date.now()
): AppRuntimeState {
  if (nextMode === runtime.activeMode) {
    return runtime;
  }

  const { words, modeWordCache } = getWordsForMode(
    sourceWords,
    nextMode,
    runtime.modeWordCache
  );
  const currentWpm = runtime.reader.currentWpm;
  const nextReader = {
    ...createReader(words, currentWpm),
    currentIndex: mapPositionToNewWords(
      runtime.reader.currentIndex,
      runtime.reader.words,
      words
    ),
    state: runtime.reader.state === "finished" ? ("finished" as const) : ("paused" as const),
  };

  let nextSession = runtime.session;
  if (runtime.reader.state === "playing") {
    nextSession = markPaused(nextSession, nowMs);
  }

  if (nextSession.currentWpm !== currentWpm) {
    nextSession = { ...nextSession, currentWpm };
  }

  return {
    ...runtime,
    activeMode: nextMode,
    reader: nextReader,
    session: nextSession,
    modeWordCache,
  };
}

export function applyAppModeInput(
  runtime: AppRuntimeState,
  sourceWords: Word[],
  input: string,
  nowMs = Date.now()
): AppRuntimeState {
  const nextMode = getReadingModeForInput(input);
  if (nextMode === null || runtime.helpVisible) {
    return runtime;
  }

  return switchAppReadingMode(runtime, sourceWords, nextMode, nowMs);
}
