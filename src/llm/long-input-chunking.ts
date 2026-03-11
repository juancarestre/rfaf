export const DEFAULT_LONG_INPUT_TRIGGER_BYTES = 10_000;
export const DEFAULT_LONG_INPUT_CHUNK_BYTES = 6_000;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function shouldUseLongInputChunking(
  content: string,
  triggerBytes = DEFAULT_LONG_INPUT_TRIGGER_BYTES
): boolean {
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

        let start = 0;
        while (start < word.length) {
          let end = Math.min(word.length, start + maxBytes);
          while (end > start && byteLength(word.slice(start, end)) > maxBytes) {
            end -= 1;
          }

          if (end === start) {
            break;
          }

          packed.push(word.slice(start, end));
          start = end;
        }
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

  const slices: string[] = [];
  let start = 0;
  while (start < segment.length) {
    let end = Math.min(segment.length, start + maxBytes);
    while (end > start && byteLength(segment.slice(start, end)) > maxBytes) {
      end -= 1;
    }

    if (end === start) {
      break;
    }

    slices.push(segment.slice(start, end));
    start = end;
  }

  return slices;
}

export function splitIntoLongInputChunks(
  content: string,
  maxBytes = DEFAULT_LONG_INPUT_CHUNK_BYTES
): string[] {
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

  for (const segment of segments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (byteLength(candidate) <= maxBytes) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = segment;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
