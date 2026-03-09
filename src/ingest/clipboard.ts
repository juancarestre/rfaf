import { assertInputWithinLimit, DEFAULT_MAX_INPUT_BYTES } from "./constants";
import { IngestFileError } from "./errors";
import { countWords } from "./metrics";
import type { Document } from "./types";

type ClipboardReadText = () => Promise<string>;

interface ReadClipboardOptions {
  maxBytes?: number;
  readText?: ClipboardReadText;
}

declare global {
  // test seam for CLI contract/preload fixtures
  var __RFAF_TEST_READ_CLIPBOARD__: ClipboardReadText | undefined;
}

interface ClipboardCommand {
  command: string[];
}

function commandCandidatesForPlatform(platform: NodeJS.Platform): ClipboardCommand[] {
  if (platform === "darwin") {
    return [{ command: ["pbpaste"] }];
  }

  if (platform === "win32") {
    return [
      {
        command: ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
      },
    ];
  }

  return [
    { command: ["wl-paste", "--no-newline"] },
    { command: ["xclip", "-selection", "clipboard", "-o"] },
    { command: ["xsel", "--clipboard", "--output"] },
  ];
}

function decodeBuffer(value: Uint8Array | ArrayBuffer | null | undefined): string {
  if (!value) {
    return "";
  }

  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  return Buffer.from(bytes).toString("utf8");
}

function isCommandUnavailable(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("command not found") ||
    normalized.includes("not recognized") ||
    normalized.includes("no such file")
  );
}

function normalizeClipboardReadError(error: unknown): IngestFileError {
  if (error instanceof IngestFileError) {
    return error;
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (
    message.includes("no clipboard") ||
    message.includes("clipboard is unavailable") ||
    message.includes("no such file") ||
    message.includes("command not found") ||
    message.includes("not recognized")
  ) {
    return new IngestFileError(
      "CLIPBOARD_UNAVAILABLE",
      "Clipboard is unavailable on this system"
    );
  }

  if (
    message.includes("permission") ||
    message.includes("denied") ||
    message.includes("not authorized")
  ) {
    return new IngestFileError(
      "CLIPBOARD_PERMISSION_DENIED",
      "Clipboard access denied"
    );
  }

  if (message === "input exceeds maximum supported size") {
    return new IngestFileError("INPUT_TOO_LARGE", "Input exceeds maximum supported size");
  }

  return new IngestFileError("CLIPBOARD_READ_FAILED", "Failed to read clipboard");
}

async function readSystemClipboard(): Promise<string> {
  const candidates = commandCandidatesForPlatform(process.platform);
  let lastFailure: Error | null = null;

  for (const candidate of candidates) {
    const result = Bun.spawnSync(candidate.command, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode === 0) {
      return decodeBuffer(result.stdout);
    }

    const stderr = decodeBuffer(result.stderr).trim();
    if (isCommandUnavailable(stderr)) {
      continue;
    }

    lastFailure = new Error(stderr || "clipboard backend failed");
    break;
  }

  if (lastFailure) {
    throw lastFailure;
  }

  throw new Error("no clipboard backend found");
}

export async function readClipboard(options: ReadClipboardOptions = {}): Promise<Document> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const readText =
    options.readText ?? globalThis.__RFAF_TEST_READ_CLIPBOARD__ ?? readSystemClipboard;

  try {
    const content = await readText();

    if (!content.trim()) {
      throw new IngestFileError("CLIPBOARD_EMPTY", "Clipboard is empty");
    }

    const byteLength = new TextEncoder().encode(content).length;
    try {
      assertInputWithinLimit(byteLength, maxBytes);
    } catch (error: unknown) {
      throw normalizeClipboardReadError(error);
    }

    return {
      content,
      source: "clipboard",
      wordCount: countWords(content),
    };
  } catch (error: unknown) {
    throw normalizeClipboardReadError(error);
  }
}
