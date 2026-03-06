import type { ReadingMode } from "../cli/mode-option";
import { applyBionicMode } from "./bionic";
import { chunkWords } from "./chunker";
import type { Word } from "./types";

export type ModeWordCache = Partial<Record<ReadingMode, Word[]>>;

export function transformWordsForMode(words: Word[], readingMode: ReadingMode): Word[] {
  switch (readingMode) {
    case "chunked":
      return chunkWords(words);
    case "bionic":
      return applyBionicMode(words);
    case "rsvp":
    case "scroll":
      return words;
  }
}

export function getWordsForMode(
  sourceWords: Word[],
  readingMode: ReadingMode,
  modeWordCache: ModeWordCache
): { words: Word[]; modeWordCache: ModeWordCache } {
  const cached = modeWordCache[readingMode];
  if (cached) {
    return { words: cached, modeWordCache };
  }

  const transformedWords = transformWordsForMode(sourceWords, readingMode);
  return {
    words: transformedWords,
    modeWordCache: {
      ...modeWordCache,
      [readingMode]: transformedWords,
    },
  };
}
