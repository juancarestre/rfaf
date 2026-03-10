import type { Word } from "./types";

const EDGE_PUNCTUATION_REGEX = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function normalizeComparableToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(EDGE_PUNCTUATION_REGEX, "");
}

function phraseTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => normalizeComparableToken(token))
    .filter((token) => token.length > 0);
}

interface PhrasePattern {
  raw: string;
  tokens: string[];
}

interface PhrasePatternIndex {
  patterns: PhrasePattern[];
  byFirstToken: Map<string, PhrasePattern[]>;
}

function buildPatternIndex(phrases: string[]): PhrasePatternIndex {
  const seen = new Set<string>();
  const patterns: PhrasePattern[] = [];

  for (const phrase of phrases) {
    const tokens = phraseTokens(phrase);
    if (tokens.length === 0) {
      continue;
    }

    const key = tokens.join(" ");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    patterns.push({ raw: phrase, tokens });
  }

  patterns.sort((a, b) => b.tokens.length - a.tokens.length || a.raw.localeCompare(b.raw));

  const byFirstToken = new Map<string, PhrasePattern[]>();
  for (const pattern of patterns) {
    const firstToken = pattern.tokens[0];
    if (!firstToken) {
      continue;
    }

    const candidates = byFirstToken.get(firstToken) ?? [];
    candidates.push(pattern);
    byFirstToken.set(firstToken, candidates);
  }

  return { patterns, byFirstToken };
}

function matchesAt(words: string[], start: number, pattern: PhrasePattern): boolean {
  if (start + pattern.tokens.length > words.length) {
    return false;
  }

  for (let offset = 0; offset < pattern.tokens.length; offset++) {
    if (words[start + offset] !== pattern.tokens[offset]) {
      return false;
    }
  }

  return true;
}

export function annotateWordsWithKeyPhrases(words: Word[], phrases: string[]): Word[] {
  if (words.length === 0) {
    return words;
  }

  const stripExistingFlags = (): Word[] => {
    let changed = false;
    const stripped = words.map((word) => {
      if (word.keyPhraseMatch === undefined) {
        return word;
      }

      changed = true;
      const { keyPhraseMatch: _removed, ...rest } = word;
      return rest;
    });

    return changed ? stripped : words;
  };

  if (phrases.length === 0) {
    return stripExistingFlags();
  }

  const normalizedWords = words.map((word) => normalizeComparableToken(word.text));
  const patternIndex = buildPatternIndex(phrases);
  if (patternIndex.patterns.length === 0) {
    return stripExistingFlags();
  }

  const matched = new Array<boolean>(words.length).fill(false);

  for (let index = 0; index < normalizedWords.length; index++) {
    if (!normalizedWords[index]) {
      continue;
    }

    const candidates = patternIndex.byFirstToken.get(normalizedWords[index] ?? "") ?? [];
    let matchedPattern: PhrasePattern | null = null;
    for (const pattern of candidates) {
      if (matchesAt(normalizedWords, index, pattern)) {
        matchedPattern = pattern;
        break;
      }
    }

    if (!matchedPattern) {
      continue;
    }

    for (let offset = 0; offset < matchedPattern.tokens.length; offset++) {
      matched[index + offset] = true;
    }

    index += matchedPattern.tokens.length - 1;
  }

  return words.map((word, index) => {
    const shouldMatch = matched[index] ?? false;
    if (!shouldMatch && word.keyPhraseMatch === undefined) {
      return word;
    }

    if (!shouldMatch) {
      const { keyPhraseMatch: _removed, ...rest } = word;
      return rest;
    }

    if (word.keyPhraseMatch === true) {
      return word;
    }

    return {
      ...word,
      keyPhraseMatch: true,
    };
  });
}
