import type { Document } from "./types";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function readStdin(): Promise<Document> {
  const content = await Bun.stdin.text();

  if (!content.trim()) {
    throw new Error("File is empty");
  }

  return {
    content,
    source: "stdin",
    wordCount: countWords(content),
  };
}
