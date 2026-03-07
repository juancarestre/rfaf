import type { Word } from "../processor/types";

const targetIndexLookupCache = new WeakMap<Word[], number[]>();

function getWordSourceBounds(word: Word): { start: number; end: number } {
  const sourceWords = word.sourceWords;
  if (sourceWords && sourceWords.length > 0) {
    return {
      start: sourceWords[0]?.index ?? word.index,
      end: sourceWords[sourceWords.length - 1]?.index ?? word.index,
    };
  }

  return {
    start: word.index,
    end: word.index,
  };
}

function getTargetIndexLookup(targetWords: Word[]): number[] {
  const cached = targetIndexLookupCache.get(targetWords);
  if (cached) {
    return cached;
  }

  let highestSourceIndex = -1;
  const boundsByWord = targetWords.map((word) => {
    const bounds = getWordSourceBounds(word);
    highestSourceIndex = Math.max(highestSourceIndex, bounds.end);
    return bounds;
  });

  const lookup = new Array<number>(highestSourceIndex + 1).fill(-1);
  boundsByWord.forEach((bounds, targetIndex) => {
    for (let sourceIndex = bounds.start; sourceIndex <= bounds.end; sourceIndex++) {
      lookup[sourceIndex] = targetIndex;
    }
  });

  targetIndexLookupCache.set(targetWords, lookup);
  return lookup;
}

export function mapPositionToNewWords(
  currentIndex: number,
  currentWords: Word[],
  targetWords: Word[]
): number {
  if (currentWords.length <= 1 || targetWords.length <= 1) {
    return 0;
  }

  const currentWord = currentWords[Math.min(currentWords.length - 1, Math.max(0, currentIndex))];
  if (currentWord) {
    const sourceIndex = getWordSourceBounds(currentWord).end;
    const targetIndex = getTargetIndexLookup(targetWords)[sourceIndex] ?? -1;

    if (targetIndex !== -1) {
      return targetIndex;
    }
  }

  const progressRatio = currentIndex / (currentWords.length - 1);
  return Math.min(
    targetWords.length - 1,
    Math.round(progressRatio * (targetWords.length - 1))
  );
}
