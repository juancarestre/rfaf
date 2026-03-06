import { sanitizeTerminalText } from "../terminal/sanitize-terminal-text";
import type { Word } from "./types";

/**
 * Precomputed mapping from word indices to line indices.
 *
 * Lines are computed by wrapping the word array based on terminal width.
 * Each word occupies text.length characters, and words are separated by
 * a single space. A word that would exceed the remaining line width
 * starts a new line, unless it's the first word on the line (long words
 * get their own line regardless of width).
 */
export interface LineMap {
  /** Total number of lines after wrapping */
  totalLines: number;
  /** For each word index, the line index it belongs to */
  wordToLine: number[];
  /** For each line index, the first word index on that line */
  lineToFirstWord: number[];
}

function getDisplayWordWidth(word: Word): number {
  return sanitizeTerminalText(word.text).length;
}

/**
 * Compute a line map by wrapping words into lines based on terminal width.
 *
 * Each word occupies `word.text.length` characters. Words are separated by
 * a single space. When the next word would exceed the remaining width on
 * the current line, it starts a new line. A word that is the first on its
 * line always fits (long words get their own line).
 */
export function computeLineMap(words: Word[], terminalWidth: number): LineMap {
  if (words.length === 0) {
    return { totalLines: 0, wordToLine: [], lineToFirstWord: [] };
  }

  const wordToLine = new Array<number>(words.length);
  const lineToFirstWord: number[] = [0];

  let currentLine = 0;
  let currentLineWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const wordLen = getDisplayWordWidth(words[i]!);

    if (i === 0) {
      // First word always goes on line 0
      wordToLine[i] = 0;
      currentLineWidth = wordLen;
      continue;
    }

    // Would adding space + word exceed the line width?
    const neededWidth = currentLineWidth + 1 + wordLen;

    if (neededWidth > terminalWidth) {
      // Start a new line
      currentLine++;
      lineToFirstWord.push(i);
      wordToLine[i] = currentLine;
      currentLineWidth = wordLen;
    } else {
      // Fits on current line
      wordToLine[i] = currentLine;
      currentLineWidth = neededWidth;
    }
  }

  return {
    totalLines: currentLine + 1,
    wordToLine,
    lineToFirstWord,
  };
}

/**
 * Get the line index for a given word index.
 * Clamps out-of-bounds indices.
 */
export function getLineForWordIndex(lineMap: LineMap, wordIndex: number): number {
  if (lineMap.totalLines === 0) return 0;
  if (wordIndex < 0) return 0;
  if (wordIndex >= lineMap.wordToLine.length) return lineMap.totalLines - 1;
  return lineMap.wordToLine[wordIndex]!;
}

/**
 * Get the first word index for a given line.
 * Clamps out-of-bounds line indices.
 */
export function getFirstWordIndexForLine(lineMap: LineMap, lineIndex: number): number {
  if (lineMap.lineToFirstWord.length === 0) return 0;
  if (lineIndex < 0) return 0;
  if (lineIndex >= lineMap.lineToFirstWord.length) {
    return lineMap.lineToFirstWord[lineMap.lineToFirstWord.length - 1]!;
  }
  return lineMap.lineToFirstWord[lineIndex]!;
}

export function getLastWordIndexForLine(lineMap: LineMap, lineIndex: number): number {
  if (lineMap.lineToFirstWord.length === 0) return 0;

  const safeLineIndex = Math.max(0, Math.min(lineIndex, lineMap.totalLines - 1));
  if (safeLineIndex >= lineMap.totalLines - 1) {
    return lineMap.wordToLine.length - 1;
  }

  return getFirstWordIndexForLine(lineMap, safeLineIndex + 1) - 1;
}

export function getNextLineStartIndex(lineMap: LineMap, currentWordIndex: number): number {
  const currentLine = getLineForWordIndex(lineMap, currentWordIndex);
  const nextLine = Math.min(currentLine + 1, Math.max(0, lineMap.totalLines - 1));
  return getFirstWordIndexForLine(lineMap, nextLine);
}

export function getPreviousLineStartIndex(
  lineMap: LineMap,
  currentWordIndex: number
): number {
  const currentLine = getLineForWordIndex(lineMap, currentWordIndex);
  const previousLine = Math.max(0, currentLine - 1);
  return getFirstWordIndexForLine(lineMap, previousLine);
}
