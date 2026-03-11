export const DEFAULT_LONG_INPUT_TRIGGER_BYTES = 10_000;
export const DEFAULT_LONG_INPUT_CHUNK_BYTES = 6_000;
export const MAX_LONG_INPUT_CHUNKS = 128;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Long-input chunking failed: ${label} must be a positive integer.`);
  }
}

interface CodePointByteIndex {
  boundaries: number[];
  cumulativeBytes: number[];
}

function buildCodePointByteIndex(value: string): CodePointByteIndex {
  const boundaries = [0];
  const cumulativeBytes = [0];
  let codeUnitIndex = 0;
  let totalBytes = 0;

  for (const symbol of value) {
    codeUnitIndex += symbol.length;
    totalBytes += byteLength(symbol);
    boundaries.push(codeUnitIndex);
    cumulativeBytes.push(totalBytes);
  }

  return {
    boundaries,
    cumulativeBytes,
  };
}

function maxFittingBoundary(
  index: CodePointByteIndex,
  startBoundaryIndex: number,
  maxBytes: number
): number {
  let low = startBoundaryIndex + 1;
  let high = index.boundaries.length - 1;
  let best = startBoundaryIndex;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const bytes = index.cumulativeBytes[middle] - index.cumulativeBytes[startBoundaryIndex];
    if (bytes <= maxBytes) {
      best = middle;
      low = middle + 1;
      continue;
    }

    high = middle - 1;
  }

  return best;
}

function splitByMaxBytes(value: string, maxBytes: number): string[] {
  if (!value) {
    return [];
  }

  const index = buildCodePointByteIndex(value);
  const slices: string[] = [];
  let startBoundaryIndex = 0;

  while (startBoundaryIndex < index.boundaries.length - 1) {
    const endBoundaryIndex = maxFittingBoundary(index, startBoundaryIndex, maxBytes);
    if (endBoundaryIndex === startBoundaryIndex) {
      throw new Error("Long-input chunking failed: unable to compute a safe unicode boundary.");
    }

    slices.push(
      value.slice(index.boundaries[startBoundaryIndex], index.boundaries[endBoundaryIndex])
    );
    startBoundaryIndex = endBoundaryIndex;
  }

  return slices;
}

export function shouldUseLongInputChunking(
  content: string,
  triggerBytes = DEFAULT_LONG_INPUT_TRIGGER_BYTES
): boolean {
  assertPositiveInteger(triggerBytes, "triggerBytes");
  return byteLength(content) >= triggerBytes;
}

function splitOversizedSegment(segment: string, maxBytes: number): string[] {
  if (byteLength(segment) <= maxBytes) {
    return [segment];
  }

  const sentences = segment.split(/(?<=[.!?。！？])\s+/u).filter(Boolean);
  if (sentences.length > 1) {
    const packed: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (byteLength(candidate) <= maxBytes) {
        current = candidate;
        continue;
      }

      if (current) {
        packed.push(current);
      }

      if (byteLength(sentence) <= maxBytes) {
        current = sentence;
        continue;
      }

      const words = sentence.split(/\s+/).filter(Boolean);
      let chunk = "";
      for (const word of words) {
        const next = chunk ? `${chunk} ${word}` : word;
        if (byteLength(next) <= maxBytes) {
          chunk = next;
          continue;
        }

        if (chunk) {
          packed.push(chunk);
          chunk = "";
        }

        if (byteLength(word) <= maxBytes) {
          chunk = word;
          continue;
        }

        packed.push(...splitByMaxBytes(word, maxBytes));
      }

      if (chunk) {
        packed.push(chunk);
      }

      current = "";
    }

    if (current) {
      packed.push(current);
    }

    return packed;
  }

  return splitByMaxBytes(segment, maxBytes);
}

export function splitIntoLongInputChunks(
  content: string,
  maxBytes = DEFAULT_LONG_INPUT_CHUNK_BYTES,
  maxChunks = MAX_LONG_INPUT_CHUNKS
): string[] {
  assertPositiveInteger(maxBytes, "maxBytes");
  assertPositiveInteger(maxChunks, "maxChunks");

  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments =
    paragraphs.length > 0
      ? paragraphs.flatMap((part) => splitOversizedSegment(part, maxBytes))
      : splitOversizedSegment(trimmed, maxBytes);

  const chunks: string[] = [];
  let current = "";

  const pushChunk = (chunk: string) => {
    chunks.push(chunk);
    if (chunks.length > maxChunks) {
      throw new Error("Long-input chunking failed: chunk count exceeds maximum supported limit.");
    }
  };

  for (const segment of segments) {
    if (byteLength(segment) > maxBytes) {
      throw new Error("Long-input chunking failed: produced oversized segment.");
    }

    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (byteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }

    if (current) {
      pushChunk(current);
    }
    current = segment;
  }

  if (current) {
    pushChunk(current);
  }

  return chunks;
}
