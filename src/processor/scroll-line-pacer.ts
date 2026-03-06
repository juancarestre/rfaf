import type { Word } from "./types";
import { getDisplayTime } from "./pacer";

/**
 * Calculate the dwell time for a line of words at a given WPM.
 *
 * The dwell time is the sum of getDisplayTime for all constituent words,
 * preserving the existing WPM semantics and semantic multipliers
 * (sentence-end, clause-break, paragraph-break).
 */
export function getLineDwellTime(words: Word[], wpm: number): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + getDisplayTime(word, wpm), 0);
}
