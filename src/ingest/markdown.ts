import { basename } from "node:path";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import {
  assertInputWithinLimit,
  DEFAULT_MAX_INPUT_BYTES,
} from "./constants";
import { IngestFileError } from "./errors";
import { countWords } from "./metrics";
import type { Document } from "./types";

const CODE_BLOCK_PLACEHOLDER = "[code block omitted]";
const IMAGE_PLACEHOLDER = "[image omitted]";
const TABLE_PLACEHOLDER = "[table omitted]";
const BINARY_SNIFF_BYTES = 8192;
const DEFAULT_PARSE_TIMEOUT_MS = 3_000;

export interface ReadMarkdownFileOptions {
  maxRawBytes?: number;
  maxExtractedBytes?: number;
  parseTimeoutMs?: number;
  getRawByteLength?: (path: string) => number | Promise<number>;
  readBytes?: (path: string) => Promise<Uint8Array>;
  parseText?: (markdown: string, signal?: AbortSignal) => Promise<string>;
}

function hasNullByte(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if (byte === 0) {
      return true;
    }
  }

  return false;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeInlineContent(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, IMAGE_PLACEHOLDER)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/<(?:https?:\/\/[^>]+)>/gi, "")
      .replace(/\*\*|__|\*|_|~~/g, "")
  );
}

function isFenceMarker(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

function isReferenceLinkDefinition(line: string): boolean {
  return /^\s*\[[^\]]+\]:\s+\S+/.test(line);
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line);
}

function isUnorderedListLine(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line);
}

function isHeadingLine(line: string): boolean {
  return /^\s{0,3}#{1,6}\s+/.test(line);
}

function isIndentedCodeLine(line: string): boolean {
  return /^(?:\t| {4,})/.test(line);
}

function isTableAlignmentLine(line: string): boolean {
  return /^\s*\|?\s*:?[-]{2,}:?\s*(?:\|\s*:?[-]{2,}:?\s*)+\|?\s*$/.test(line);
}

function isTableRowLine(line: string): boolean {
  return line.includes("|");
}

function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new IngestFileError("MARKDOWN_PARSE_FAILED", "Markdown parsing timed out"));
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

async function parseMarkdownText(markdown: string, signal?: AbortSignal): Promise<string> {
  const preprocessed = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/<table[\s\S]*?<\/table>/gi, `\n${TABLE_PLACEHOLDER}\n`)
    .replace(/<img\b[^>]*>/gi, IMAGE_PLACEHOLDER);

  const lines = preprocessed.split("\n");
  const blocks: string[] = [];
  const paragraphLines: string[] = [];
  let inFence = false;

  const flushParagraph = () => {
    const text = normalizeInlineContent(paragraphLines.join(" "));
    paragraphLines.length = 0;
    if (text) {
      blocks.push(text);
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (signal?.aborted) {
      throw new IngestFileError("MARKDOWN_PARSE_FAILED", "Markdown parsing timed out");
    }

    const line = lines[index];
    const trimmed = line.trim();

    if (inFence) {
      if (isFenceMarker(line)) {
        inFence = false;
      }
      continue;
    }

    if (isFenceMarker(line)) {
      flushParagraph();
      blocks.push(CODE_BLOCK_PLACEHOLDER);
      inFence = true;
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }

    if (isReferenceLinkDefinition(trimmed)) {
      continue;
    }

    if (isIndentedCodeLine(line)) {
      flushParagraph();
      blocks.push(CODE_BLOCK_PLACEHOLDER);
      while (index + 1 < lines.length && isIndentedCodeLine(lines[index + 1])) {
        index += 1;
      }
      continue;
    }

    if (isTableRowLine(line) && index + 1 < lines.length && isTableAlignmentLine(lines[index + 1])) {
      flushParagraph();
      blocks.push(TABLE_PLACEHOLDER);
      index += 1;
      while (index + 1 < lines.length && isTableRowLine(lines[index + 1])) {
        index += 1;
      }
      continue;
    }

    if (isHeadingLine(line)) {
      flushParagraph();
      const headingMatch = line.match(/^(\s{0,3}#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const headingText = normalizeInlineContent(headingMatch[2]);
        if (headingText) {
          blocks.push(`${headingMatch[1].trim()} ${headingText}`);
        }
      }
      continue;
    }

    if (isUnorderedListLine(line)) {
      flushParagraph();
      const item = normalizeInlineContent(line.replace(/^\s*[-*+]\s+/, ""));
      if (item) {
        blocks.push(`- ${item}`);
      }
      continue;
    }

    if (isOrderedListLine(line)) {
      flushParagraph();
      const markerMatch = line.match(/^\s*(\d+\.)\s+(.*)$/);
      if (markerMatch) {
        const item = normalizeInlineContent(markerMatch[2]);
        if (item) {
          blocks.push(`${markerMatch[1]} ${item}`);
        }
      }
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks.join("\n\n").trim();
}

function normalizeMarkdownParseError(error: unknown): Error {
  if (error instanceof IngestFileError) {
    return error;
  }

  if (error instanceof Error && error.message === "Input exceeds maximum supported size") {
    return new IngestFileError("INPUT_TOO_LARGE", error.message);
  }

  return new IngestFileError("MARKDOWN_PARSE_FAILED", "Failed to parse Markdown file");
}

export async function readMarkdownFile(
  path: string,
  options: ReadMarkdownFileOptions = {}
): Promise<Document> {
  const maxRawBytes = options.maxRawBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const parseTimeoutMs = options.parseTimeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const parseText = options.parseText ?? parseMarkdownText;
  const getRawByteLength =
    options.getRawByteLength ?? ((targetPath: string) => Bun.file(targetPath).size);
  const readBytes = options.readBytes ?? ((targetPath: string) => Bun.file(targetPath).bytes());
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new IngestFileError("FILE_NOT_FOUND", "File not found");
  }

  const rawByteLength = await getRawByteLength(path);
  assertInputWithinLimit(rawByteLength, maxRawBytes);

  const bytes = await readBytes(path);
  assertInputWithinLimit(bytes.length, maxRawBytes);

  const sniff = bytes.subarray(0, Math.min(BINARY_SNIFF_BYTES, bytes.length));
  if (hasNullByte(sniff)) {
    throw new IngestFileError("BINARY_FILE", "Binary file detected");
  }

  const rawMarkdown = new TextDecoder().decode(bytes);

  let content: string;
  try {
    content = await withTimeout((signal) => parseText(rawMarkdown, signal), parseTimeoutMs);
  } catch (error: unknown) {
    throw normalizeMarkdownParseError(error);
  }

  if (!content.trim()) {
    throw new IngestFileError("MARKDOWN_EMPTY_TEXT", "Markdown has no readable text");
  }

  const extractedByteLength = Buffer.byteLength(content, "utf8");
  assertInputWithinLimit(extractedByteLength, maxExtractedBytes);

  return {
    content,
    source: sanitizeTerminalText(basename(path)),
    wordCount: countWords(content),
  };
}
