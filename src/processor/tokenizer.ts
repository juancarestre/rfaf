import type { Word, PunctuationTier } from "./types";

/**
 * Detect the punctuation tier of a word based on its trailing characters.
 */
function detectPunctuation(text: string): PunctuationTier | null {
  // Check for sentence-ending punctuation (including inside quotes)
  if (/[.!?]['"'"\u201C\u201D\u2018\u2019)}\]]*$/.test(text)) {
    return "sentence_end";
  }
  // Check for clause-break punctuation
  if (/[;:]$/.test(text)) {
    return "clause_break";
  }
  // Check for trailing comma — but not commas inside numbers like 3,000,000
  if (/,$/.test(text) && !/^\d[\d,]*\d$/.test(text)) {
    return "clause_break";
  }
  return null;
}

/**
 * Tokenize text into an array of Words with metadata.
 *
 * Rules:
 * - Split on whitespace (simple, predictable)
 * - Paragraph breaks = \n\n or more consecutive newlines
 * - Trim; throw if empty after trim
 * - Hyphenated words, contractions, URLs stay as one token
 */
export function tokenize(text: string): Word[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("File is empty");
  }

  // Split into paragraphs on 2+ consecutive newlines
  const paragraphs = trimmed.split(/\n{2,}/);

  const words: Word[] = [];
  let globalIndex = 0;

  for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
    const paragraph = paragraphs[paraIdx].trim();
    if (paragraph.length === 0) continue;

    // Split paragraph into words on whitespace
    const tokens = paragraph.split(/\s+/).filter((t) => t.length > 0);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isLastInParagraph = i === tokens.length - 1;
      const isLastParagraph = paraIdx === paragraphs.length - 1;

      // Detect punctuation
      let punctuation = detectPunctuation(token);

      // If this is the last word before a paragraph break, paragraph_break takes precedence
      if (isLastInParagraph && !isLastParagraph) {
        punctuation = "paragraph_break";
      }

      words.push({
        text: token,
        index: globalIndex,
        paragraphIndex: paraIdx,
        isParagraphStart: i === 0,
        trailingPunctuation: punctuation,
      });

      globalIndex++;
    }
  }

  if (words.length === 0) {
    throw new Error("File is empty");
  }

  return words;
}
