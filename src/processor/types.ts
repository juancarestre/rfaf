/**
 * Punctuation tier for timing multipliers.
 * - sentence_end: . ! ? (including ." !' ?")
 * - clause_break: , ; :
 * - paragraph_break: \n\n+ boundary
 */
export type PunctuationTier = "sentence_end" | "clause_break" | "paragraph_break";

/**
 * A single word with metadata for RSVP display and timing.
 */
export interface Word {
  /** The word text (whitespace-delimited token) */
  text: string;
  /** Position in the word array (0-based) */
  index: number;
  /** Which paragraph this word belongs to (0-based) */
  paragraphIndex: number;
  /** Whether this is the first word of a paragraph */
  isParagraphStart: boolean;
  /** Trailing punctuation tier, or null if none */
  trailingPunctuation: PunctuationTier | null;
  /** Optional source words when this entry represents a grouped chunk */
  sourceWords?: Word[];
  /** Optional leading character count to emphasize in bionic mode */
  bionicPrefixLength?: number;
}
