import type { Word } from "./types";

/** Minimum display time for the first word (ms) */
const FIRST_WORD_MIN_MS = 200;

/** Base multiplier for plain words (slight speedup) */
const BASE_MULTIPLIER = 0.9;

/** Multiplier for sentence-ending punctuation (. ! ?) */
const SENTENCE_END_MULTIPLIER = 3.0;

/** Multiplier for clause-break punctuation (, ; :) */
const CLAUSE_BREAK_MULTIPLIER = 2.0;

/** Extra pause added for paragraph breaks (multiplied by baseMs) */
const PARAGRAPH_BREAK_EXTRA = 4.0;

/** Factor for word-length penalty: sqrt(length) * this value */
const LENGTH_PENALTY_FACTOR = 0.04;

/**
 * Calculate the display time in milliseconds for a given word at a given WPM.
 *
 * Based on the `speedread` timing model:
 * - Base time = 60000 / wpm
 * - Plain words get 0.9x multiplier (slight speedup for common short words)
 * - Sentence-ending punctuation gets 3.0x
 * - Clause-break punctuation gets 2.0x
 * - Word length adds a sqrt(length) * 0.04 penalty
 * - Paragraph breaks add an extra 4.0 * baseMs pause
 * - First word (index 0) has a minimum of 200ms
 */
export function getDisplayTime(word: Word, wpm: number): number {
  if (word.sourceWords && word.sourceWords.length > 0) {
    return word.sourceWords.reduce(
      (total, sourceWord) => total + getDisplayTime(sourceWord, wpm),
      0
    );
  }

  const baseMs = 60_000 / wpm;

  // Punctuation multiplier
  let multiplier = BASE_MULTIPLIER;
  if (word.trailingPunctuation === "sentence_end") {
    multiplier = SENTENCE_END_MULTIPLIER;
  } else if (word.trailingPunctuation === "clause_break") {
    multiplier = CLAUSE_BREAK_MULTIPLIER;
  } else if (word.trailingPunctuation === "paragraph_break") {
    // Paragraph break: use base multiplier but add extra pause below
    multiplier = BASE_MULTIPLIER;
  }

  // Word-length penalty
  const lengthPenalty = Math.sqrt(word.text.length) * LENGTH_PENALTY_FACTOR;

  let duration = (multiplier + lengthPenalty) * baseMs;

  // Paragraph break: add extra pause
  if (word.trailingPunctuation === "paragraph_break") {
    duration += PARAGRAPH_BREAK_EXTRA * baseMs;
  }

  // First word minimum
  if (word.index === 0) {
    duration = Math.max(duration, FIRST_WORD_MIN_MS);
  }

  return duration;
}
