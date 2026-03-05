import type { Document } from "./types";
import { assertInputWithinLimit, DEFAULT_MAX_INPUT_BYTES } from "./constants";
import { countWords } from "./metrics";

const BINARY_SNIFF_BYTES = 8192;

interface ReadPlaintextFileOptions {
  maxBytes?: number;
}

function hasNullByte(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b === 0) return true;
  }
  return false;
}

export async function readPlaintextFile(
  path: string,
  options: ReadPlaintextFileOptions = {}
): Promise<Document> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error("File not found");
  }

  const bytes = await file.bytes();
  assertInputWithinLimit(bytes.length, maxBytes);
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
