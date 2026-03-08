import { basename } from "node:path";
import { PDFParse } from "pdf-parse";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import {
  assertInputWithinLimit,
  DEFAULT_MAX_INPUT_BYTES,
} from "./constants";
import { countWords } from "./metrics";
import type { Document } from "./types";

export interface ReadPdfFileOptions {
  maxRawBytes?: number;
  maxExtractedBytes?: number;
  parseTimeoutMs?: number;
  getRawByteLength?: (path: string) => number | Promise<number>;
  readBytes?: (path: string) => Promise<Uint8Array>;
  parseText?: (bytes: Uint8Array) => Promise<string>;
}

const DEFAULT_PARSE_TIMEOUT_MS = 10_000;

async function parsePdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function normalizePdfParseError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.name === "PasswordException") {
      return new Error("PDF is encrypted or password-protected");
    }

    if (error.name === "InvalidPDFException" || error.name === "FormatError") {
      return new Error("Invalid or corrupted PDF file");
    }

    if (error.message === "PDF parsing timed out") {
      return error;
    }

    return new Error("Failed to parse PDF file");
  }

  return new Error("Failed to parse PDF file");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("PDF parsing timed out"));
    }, timeoutMs);

    promise.then(
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

export async function readPdfFile(
  path: string,
  options: ReadPdfFileOptions = {}
): Promise<Document> {
  const maxRawBytes = options.maxRawBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const parseTimeoutMs = options.parseTimeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const parseText = options.parseText ?? parsePdfText;
  const getRawByteLength =
    options.getRawByteLength ?? ((targetPath: string) => Bun.file(targetPath).size);
  const readBytes = options.readBytes ?? ((targetPath: string) => Bun.file(targetPath).bytes());
  const file = Bun.file(path);

  if (!(await file.exists())) {
    throw new Error("File not found");
  }

  const rawByteLength = await getRawByteLength(path);
  assertInputWithinLimit(rawByteLength, maxRawBytes);

  const bytes = await readBytes(path);
  assertInputWithinLimit(bytes.length, maxRawBytes);

  let content: string;
  try {
    content = await withTimeout(parseText(bytes), parseTimeoutMs);
  } catch (error: unknown) {
    throw normalizePdfParseError(error);
  }

  if (!content.trim()) {
    throw new Error("PDF has no extractable text");
  }

  const extractedByteLength = Buffer.byteLength(content, "utf8");
  assertInputWithinLimit(extractedByteLength, maxExtractedBytes);

  return {
    content,
    source: sanitizeTerminalText(basename(path)),
    wordCount: countWords(content),
  };
}
