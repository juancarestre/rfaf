import type { Word } from "./types";

export const MIN_CHUNK_SIZE = 3;
export const MAX_CHUNK_SIZE = 5;

function shouldFlushChunk(current: Word[], nextWord: Word | undefined): boolean {
  if (current.length >= MAX_CHUNK_SIZE) {
    return true;
  }

  const last = current[current.length - 1];
  if (!last) return false;

  if (last.trailingPunctuation === "paragraph_break") {
    return true;
  }

  if (
    last.trailingPunctuation === "sentence_end" ||
    last.trailingPunctuation === "clause_break"
  ) {
    return current.length >= 2;
  }

  if (current.length < MIN_CHUNK_SIZE) {
    return false;
  }

  if (
    nextWord &&
    nextWord.isParagraphStart &&
    nextWord.paragraphIndex !== last.paragraphIndex
  ) {
    return true;
  }

  return nextWord === undefined;
}

function toChunkWord(chunkWords: Word[], chunkIndex: number): Word {
  const first = chunkWords[0];
  const last = chunkWords[chunkWords.length - 1];

  if (!first || !last) {
    throw new Error("Chunk words cannot be empty");
  }

  return {
    text: chunkWords.map((word) => word.text).join(" "),
    index: chunkIndex,
    paragraphIndex: first.paragraphIndex,
    isParagraphStart: first.isParagraphStart,
    trailingPunctuation: last.trailingPunctuation,
    sourceWords: chunkWords,
    keyPhraseMatch: chunkWords.some((word) => word.keyPhraseMatch),
  };
}

export function chunkWords(words: Word[]): Word[] {
  if (words.length === 0) {
    return [];
  }

  const chunks: Word[] = [];
  let currentChunk: Word[] = [];

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (!word) continue;

    currentChunk.push(word);
    const nextWord = words[index + 1];

    if (shouldFlushChunk(currentChunk, nextWord)) {
      chunks.push(toChunkWord(currentChunk, chunks.length));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(toChunkWord(currentChunk, chunks.length));
  }

  return chunks;
}
