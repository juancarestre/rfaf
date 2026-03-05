import type { Word } from "../processor/types";

export type ReaderMode = "idle" | "paused" | "playing" | "finished";

export interface Reader {
  words: Word[];
  currentIndex: number;
  state: ReaderMode;
  currentWpm: number;
  minWpm: number;
  maxWpm: number;
}

export type ReaderAction =
  | { type: "toggle_play" }
  | { type: "step_forward" }
  | { type: "step_backward" }
  | { type: "jump_next_paragraph" }
  | { type: "jump_prev_paragraph" }
  | { type: "set_wpm"; delta: number }
  | { type: "restart" }
  | { type: "tick" };

const MIN_WPM = 50;
const MAX_WPM = 1500;

function clampWpm(value: number): number {
  return Math.max(MIN_WPM, Math.min(MAX_WPM, value));
}

function withPausedIfPlaying(reader: Reader): Reader {
  if (reader.state !== "playing") return reader;
  return { ...reader, state: "paused" };
}

function isLastWord(reader: Reader): boolean {
  return reader.currentIndex >= reader.words.length - 1;
}

function findParagraphStartIndex(words: Word[], paragraphIndex: number): number {
  const found = words.find((word) => word.paragraphIndex === paragraphIndex);
  return found ? found.index : 0;
}

export function createReader(words: Word[], wpm = 300): Reader {
  if (words.length === 0) {
    throw new Error("Reader requires at least one word");
  }

  return {
    words,
    currentIndex: 0,
    state: "paused",
    currentWpm: clampWpm(wpm),
    minWpm: MIN_WPM,
    maxWpm: MAX_WPM,
  };
}

export function togglePlayPause(reader: Reader): Reader {
  if (reader.state === "finished") return reader;
  if (reader.state === "playing") return { ...reader, state: "paused" };
  return { ...reader, state: "playing" };
}

export function stepForward(reader: Reader): Reader {
  const pausedReader = withPausedIfPlaying(reader);
  if (isLastWord(pausedReader)) return pausedReader;
  return { ...pausedReader, currentIndex: pausedReader.currentIndex + 1 };
}

export function stepBackward(reader: Reader): Reader {
  const pausedReader = withPausedIfPlaying(reader);
  if (pausedReader.currentIndex <= 0) return pausedReader;
  return { ...pausedReader, currentIndex: pausedReader.currentIndex - 1 };
}

export function jumpToNextParagraph(reader: Reader): Reader {
  const pausedReader = withPausedIfPlaying(reader);
  const currentParagraph =
    pausedReader.words[pausedReader.currentIndex]?.paragraphIndex ?? 0;
  const nextParagraphWord = pausedReader.words.find(
    (word) =>
      word.paragraphIndex > currentParagraph &&
      word.isParagraphStart
  );

  if (!nextParagraphWord) return pausedReader;
  return { ...pausedReader, currentIndex: nextParagraphWord.index };
}

export function jumpToPreviousParagraph(reader: Reader): Reader {
  const pausedReader = withPausedIfPlaying(reader);
  const currentParagraph =
    pausedReader.words[pausedReader.currentIndex]?.paragraphIndex ?? 0;

  const currentParagraphStart = findParagraphStartIndex(
    pausedReader.words,
    currentParagraph
  );

  if (pausedReader.currentIndex > currentParagraphStart) {
    return { ...pausedReader, currentIndex: currentParagraphStart };
  }

  const previousParagraph = Math.max(currentParagraph - 1, 0);
  const previousParagraphStart = findParagraphStartIndex(
    pausedReader.words,
    previousParagraph
  );

  return { ...pausedReader, currentIndex: previousParagraphStart };
}

export function adjustWpm(reader: Reader, delta: number): Reader {
  return {
    ...reader,
    currentWpm: clampWpm(reader.currentWpm + delta),
  };
}

export function advancePlayback(reader: Reader): Reader {
  if (reader.state !== "playing") return reader;
  if (isLastWord(reader)) return { ...reader, state: "finished" };

  const nextIndex = reader.currentIndex + 1;
  const isNowLastWord = nextIndex === reader.words.length - 1;

  return {
    ...reader,
    currentIndex: nextIndex,
    state: isNowLastWord ? "finished" : "playing",
  };
}

export function restartReader(reader: Reader): Reader {
  return {
    ...reader,
    currentIndex: 0,
    state: "paused",
  };
}

export type ReaderState = Reader;

export function createReaderState(words: Word[], wpm: number): ReaderState {
  return createReader(words, wpm);
}

export function readerDispatch(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "toggle_play":
      return togglePlayPause(state);
    case "step_forward":
      return stepForward(state);
    case "step_backward":
      return stepBackward(state);
    case "jump_next_paragraph":
      return jumpToNextParagraph(state);
    case "jump_prev_paragraph":
      return jumpToPreviousParagraph(state);
    case "set_wpm":
      return adjustWpm(state, action.delta);
    case "restart":
      return restartReader(state);
    case "tick":
      return advancePlayback(state);
    default:
      return state;
  }
}
