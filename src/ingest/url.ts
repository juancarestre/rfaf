import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import {
  assertInputWithinLimit,
  DEFAULT_MAX_INPUT_BYTES,
} from "./constants";
import { countWords } from "./metrics";
import type { Document } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export interface ReadUrlOptions {
  maxBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  userAgent?: string;
  signal?: AbortSignal;
  fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

function normalizeContentType(value: string | null): string {
  if (!value) return "";
  return value.split(";")[0].trim().toLowerCase();
}

function extractionError(url: string): Error {
  return new Error(`Could not extract article content from ${url}`);
}

function formatTimeoutLabel(timeoutMs: number): string {
  if (timeoutMs % 1000 === 0) {
    return `${timeoutMs / 1000}s`;
  }

  return `${timeoutMs}ms`;
}

async function readResponseTextWithinLimit(
  response: Response,
  maxResponseBytes: number,
  url: string
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytesRead += value.byteLength;
    if (bytesRead > maxResponseBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancellation errors after limit breach
      }
      throw new Error(`Response too large from ${url}`);
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function isAbortDomException(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function readUrl(
  url: string,
  options: ReadUrlOptions = {}
): Promise<Document> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetchFn(url, {
      headers: {
        "User-Agent": userAgent,
      },
      signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    const contentTypeHeader = response.headers.get("content-type");
    const contentType = normalizeContentType(contentTypeHeader);
    const isHtml = contentType === "text/html" || contentType === "application/xhtml+xml";
    const isPlaintext = contentType === "text/plain";

    if (!isHtml && !isPlaintext) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"} from ${url}`);
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const parsed = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsed) && parsed > maxResponseBytes) {
        throw new Error(`Response too large from ${url}`);
      }
    }

    const payload = await readResponseTextWithinLimit(response, maxResponseBytes, url);

    if (isPlaintext) {
      const byteLength = Buffer.byteLength(payload, "utf8");
      assertInputWithinLimit(byteLength, maxBytes);

      return {
        content: payload,
        source: url,
        wordCount: countWords(payload),
      };
    }

    const { document } = parseHTML(payload);

    if (!isProbablyReaderable(document, { minContentLength: 80, minScore: 10 })) {
      throw extractionError(url);
    }

    const article = new Readability(document).parse();
    const content = article?.textContent ?? "";

    if (!content.trim()) {
      throw extractionError(url);
    }

    const byteLength = Buffer.byteLength(content, "utf8");
    assertInputWithinLimit(byteLength, maxBytes);

    const sanitizedTitle = sanitizeTerminalText(article?.title ?? "");
    const source = sanitizedTitle.trim() ? sanitizedTitle : url;

    return {
      content,
      source,
      wordCount: countWords(content),
    };
  } catch (error: unknown) {
    if (timeoutSignal.aborted) {
      throw new Error(`Timed out fetching ${url} (${formatTimeoutLabel(timeoutMs)} limit)`);
    }

    if (options.signal?.aborted) {
      throw new Error(`Fetching ${url} cancelled`);
    }

    if (isAbortDomException(error)) {
      throw new Error(`Fetching ${url} cancelled`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  }
}
