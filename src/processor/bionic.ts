import type { Word } from "./types";

function countAlphaNumericChars(value: string): number {
  let count = 0;
  for (const char of value) {
    if (ALPHANUMERIC_CHAR.test(char)) {
      count += 1;
    }
  }
  return count;
}

function hasDenseConnectors(value: string): boolean {
  return /[-_/]/.test(value);
}

const ALPHANUMERIC_CHAR = /\p{L}|\p{N}/u;

export function emphasizePrefixAlphaNumeric(text: string, prefixLength: number): string {
  if (prefixLength <= 0) {
    return text;
  }

  let emphasized = "";
  let emphasizedCount = 0;

  for (const char of text) {
    if (emphasizedCount < prefixLength && ALPHANUMERIC_CHAR.test(char)) {
      emphasized += char.toUpperCase();
      emphasizedCount += 1;
    } else {
      emphasized += char;
    }
  }

  return emphasized;
}

export function resolveBionicPrefixLength(text: string): number {
  const alphaNumericLength = countAlphaNumericChars(text);

  if (alphaNumericLength <= 3) {
    return 0;
  }

  let prefixLength: number;
  if (alphaNumericLength <= 5) {
    prefixLength = 1;
  } else if (alphaNumericLength <= 9) {
    prefixLength = 2;
  } else {
    prefixLength = 3;
  }

  if (alphaNumericLength >= 16) {
    prefixLength += 1;
  }

  if (hasDenseConnectors(text) && alphaNumericLength >= 10) {
    prefixLength = Math.max(prefixLength, 3);
  }

  const cap = Math.min(4, Math.max(1, Math.floor(alphaNumericLength / 2)));
  return Math.min(prefixLength, cap);
}

export function applyBionicMode(words: Word[]): Word[] {
  return words.map((word) => {
    const bionicPrefixLength = resolveBionicPrefixLength(word.text);
    return {
      ...word,
      bionicPrefixLength,
    };
  });
}
