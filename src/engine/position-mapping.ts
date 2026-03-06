import type { Word } from "../processor/types";

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
    const targetIndex = targetWords.findIndex((word) => {
      const bounds = getWordSourceBounds(word);
      return sourceIndex >= bounds.start && sourceIndex <= bounds.end;
    });

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
