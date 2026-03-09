import { basename } from "node:path";
import { EPub } from "epub2";
import { parseHTML } from "linkedom";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import {
  assertInputWithinLimit,
  DEFAULT_MAX_INPUT_BYTES,
} from "./constants";
import { countWords } from "./metrics";
import type { Document } from "./types";

const DEFAULT_PARSE_TIMEOUT_MS = 10_000;

export interface ReadEpubFileOptions {
  maxRawBytes?: number;
  maxExtractedBytes?: number;
  parseTimeoutMs?: number;
  getRawByteLength?: (path: string) => number | Promise<number>;
  parseText?: (path: string, signal?: AbortSignal) => Promise<string>;
}

function normalizeSectionText(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function extractChapterText(chapterContent: string): string {
  const { document } = parseHTML(chapterContent);
  const bodyText = document.body?.textContent?.trim();
  const documentText = document.documentElement?.textContent?.trim();
  const text = bodyText || documentText || chapterContent;
  return normalizeSectionText(text);
}

async function parseEpubText(
  path: string,
  maxExtractedBytes: number,
  signal?: AbortSignal
): Promise<string> {
  const epub = await EPub.createAsync(path);
  const sections: string[] = [];
  let totalExtractedBytes = 0;

  for (const chapter of epub.flow ?? []) {
    if (signal?.aborted) {
      throw new Error("EPUB parsing timed out");
    }

    if (!chapter.id) {
      continue;
    }

    const chapterContent = await epub.getChapterAsync(chapter.id);
    if (signal?.aborted) {
      throw new Error("EPUB parsing timed out");
    }

    const normalized = extractChapterText(chapterContent);
    if (normalized) {
      const separatorBytes = sections.length === 0 ? 0 : 2;
      const chapterBytes = Buffer.byteLength(normalized, "utf8");
      totalExtractedBytes += separatorBytes + chapterBytes;
      assertInputWithinLimit(totalExtractedBytes, maxExtractedBytes);
      sections.push(normalized);
    }
  }

  return sections.join("\n\n");
}

function normalizeEpubParseError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message === "Input exceeds maximum supported size") {
      return error;
    }

    if (error.message === "EPUB parsing timed out") {
      return error;
    }

    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    if (
      name.includes("encrypt") ||
      name.includes("drm") ||
      message.includes("encrypted") ||
      message.includes("drm")
    ) {
      return new Error("EPUB is encrypted or DRM-protected");
    }

    if (
      name.includes("invalid") ||
      message.includes("invalid") ||
      message.includes("corrupt") ||
      message.includes("zip") ||
      message.includes("mimetype") ||
      message.includes("container.xml") ||
      message.includes("rootfile") ||
      message.includes("central directory")
    ) {
      return new Error("Invalid or corrupted EPUB file");
    }

    return new Error("Failed to parse EPUB file");
  }

  return new Error("Failed to parse EPUB file");
}

function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("EPUB parsing timed out"));
    }, timeoutMs);

    operation(controller.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function readEpubFile(
  path: string,
  options: ReadEpubFileOptions = {}
): Promise<Document> {
  const maxRawBytes = options.maxRawBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const parseTimeoutMs = options.parseTimeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const parseText = options.parseText;
  const getRawByteLength =
    options.getRawByteLength ?? ((targetPath: string) => Bun.file(targetPath).size);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error("File not found");
  }

  const rawByteLength = await getRawByteLength(path);
  assertInputWithinLimit(rawByteLength, maxRawBytes);

  let content: string;
  try {
    content = await withTimeout(
      (signal) =>
        parseText === undefined
          ? parseEpubText(path, maxExtractedBytes, signal)
          : parseText(path, signal),
      parseTimeoutMs
    );
  } catch (error: unknown) {
    throw normalizeEpubParseError(error);
  }

  if (!content.trim()) {
    throw new Error("EPUB has no extractable text");
  }

  const extractedByteLength = Buffer.byteLength(content, "utf8");
  assertInputWithinLimit(extractedByteLength, maxExtractedBytes);

  return {
    content,
    source: sanitizeTerminalText(basename(path)),
    wordCount: countWords(content),
  };
}
