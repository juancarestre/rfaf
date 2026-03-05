import type { Document } from "./types";

const BINARY_SNIFF_BYTES = 8192;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function hasNullByte(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b === 0) return true;
  }
  return false;
}

export async function readPlaintextFile(path: string): Promise<Document> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error("File not found");
  }

  const bytes = await file.bytes();
  const sniff = bytes.slice(0, Math.min(BINARY_SNIFF_BYTES, bytes.length));
  if (hasNullByte(sniff)) {
    throw new Error("Binary file detected");
  }

  const content = new TextDecoder().decode(bytes);
  if (!content.trim()) {
    throw new Error("File is empty");
  }

  return {
    content,
    source: path,
    wordCount: countWords(content),
  };
}
