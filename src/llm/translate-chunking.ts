export const DEFAULT_TRANSLATE_CHUNK_BYTES = 12_000;
export const DEFAULT_TRANSLATE_CONCURRENCY = 3;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
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
      const next = current ? `${current} ${sentence}` : sentence;
      if (byteLength(next) <= maxBytes) {
        current = next;
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
        const wordNext = chunk ? `${chunk} ${word}` : word;
        if (byteLength(wordNext) <= maxBytes) {
          chunk = wordNext;
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

export function splitIntoTranslationChunks(
  content: string,
  maxBytes = DEFAULT_TRANSLATE_CHUNK_BYTES
): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments =
    paragraphs.length > 0
      ? paragraphs.flatMap((part) => splitOversizedSegment(part, maxBytes))
      : splitOversizedSegment(content.trim(), maxBytes);

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

  return chunks.length > 0 ? chunks : [content];
}

export async function translateContentInChunks(input: {
  content: string;
  maxChunkBytes?: number;
  concurrency?: number;
  translateChunk: (chunk: string) => Promise<string>;
}): Promise<string> {
  const chunks = splitIntoTranslationChunks(input.content, input.maxChunkBytes);
  const translatedChunks = new Array<string>(chunks.length);
  const maxConcurrency = Math.max(1, input.concurrency ?? DEFAULT_TRANSLATE_CONCURRENCY);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= chunks.length) {
        return;
      }

      translatedChunks[index] = (await input.translateChunk(chunks[index])).trim();
    }
  };

  const workerCount = Math.min(maxConcurrency, chunks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return translatedChunks.join("\n\n");
}
