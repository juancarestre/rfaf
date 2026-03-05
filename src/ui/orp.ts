/**
 * Get the ORP (Optimal Recognition Point) index for a word of given length.
 *
 * Based on the Spritz/OpenSpritz lookup table. The ORP is the character
 * position where the eye naturally fixates, roughly 28-35% into the word.
 *
 * | Word Length | ORP Index (0-based) |
 * |-------------|---------------------|
 * | 0-1         | 0                   |
 * | 2-5         | 1                   |
 * | 6-9         | 2                   |
 * | 10-13       | 3                   |
 * | 14+         | 4                   |
 */
export function getORPIndex(wordLength: number): number {
  if (wordLength <= 1) return 0;
  if (wordLength <= 5) return 1;
  if (wordLength <= 9) return 2;
  if (wordLength <= 13) return 3;
  return 4;
}
