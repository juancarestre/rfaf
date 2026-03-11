export function mergeLongInputChunks(chunks: string[]): string {
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
