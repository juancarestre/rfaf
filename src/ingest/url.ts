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

interface MergedSignal {
  signal: AbortSignal;
  aborted: () => boolean;
  timedOut: () => boolean;
  dispose: () => void;
}

function isAbortLikeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  return name.includes("abort") || message.includes("abort");
}

function isTimeoutLikeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  return (
    name.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function mergeSignal(timeoutMs: number, parentSignal?: AbortSignal): MergedSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const merged = parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;

  return {
    signal: merged,
    aborted: () => merged.aborted,
    timedOut: () => timeoutSignal.aborted,
    dispose: () => {},
  };
}

function normalizeContentType(value: string | null): string {
  if (!value) return "";
  return value.split(";")[0].trim().toLowerCase();
}

function extractionError(url: string): Error {
  return new Error(`Could not extract article content from ${url}`);
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
  const mergedSignal = mergeSignal(timeoutMs, options.signal);

  try {
    const response = await fetchFn(url, {
      headers: {
        "User-Agent": userAgent,
      },
      signal: mergedSignal.signal,
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

    const payload = await response.text();

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
    if (mergedSignal.timedOut() || isTimeoutLikeError(error)) {
      throw new Error(`Timed out fetching ${url} (10s limit)`);
    }

    if (mergedSignal.aborted() || isAbortLikeError(error)) {
      throw new Error(`Fetching ${url} cancelled`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  } finally {
    mergedSignal.dispose();
  }
}
