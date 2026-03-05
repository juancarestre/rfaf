import type { Document } from "./types";
import { assertInputWithinLimit, DEFAULT_MAX_INPUT_BYTES } from "./constants";
import { countWords } from "./metrics";

interface ReadStdinOptions {
  maxBytes?: number;
  readText?: () => Promise<string>;
}

export async function readStdin(options: ReadStdinOptions = {}): Promise<Document> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const readText = options.readText ?? (() => Bun.stdin.text());

  const content = await readText();
  const byteLength = new TextEncoder().encode(content).length;
  assertInputWithinLimit(byteLength, maxBytes);

  if (!content.trim()) {
    throw new Error("File is empty");
  }

  return {
    content,
    source: "stdin",
    wordCount: countWords(content),
  };
}
