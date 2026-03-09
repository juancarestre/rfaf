import { assertInputWithinLimit, DEFAULT_MAX_INPUT_BYTES } from "./constants";
import { IngestFileError } from "./errors";
import { countWords } from "./metrics";
import type { Document } from "./types";

type ClipboardReadText = () => Promise<string>;

interface ClipboardCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

type ClipboardCommandRunner = (
  command: string[],
  timeoutMs: number
) => Promise<ClipboardCommandResult>;

interface ReadSystemClipboardOptions {
  platform: NodeJS.Platform;
  timeoutMs: number;
  runClipboardCommand: ClipboardCommandRunner;
}

const DEFAULT_CLIPBOARD_COMMAND_TIMEOUT_MS = 1_500;

interface ReadClipboardOptions {
  maxBytes?: number;
  readText?: ClipboardReadText;
  platform?: NodeJS.Platform;
  backendTimeoutMs?: number;
  runClipboardCommand?: ClipboardCommandRunner;
}

declare global {
  // test seam for CLI contract/preload fixtures
  var __RFAF_TEST_READ_CLIPBOARD__: ClipboardReadText | undefined;
}

function commandCandidatesForPlatform(platform: NodeJS.Platform): string[][] {
  if (platform === "darwin") {
    return [["pbpaste"]];
  }

  if (platform === "win32") {
    return [["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"]];
  }

  return [
    ["wl-paste", "--no-newline"],
    ["xclip", "-selection", "clipboard", "-o"],
    ["xsel", "--clipboard", "--output"],
  ];
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

function isClipboardUnavailable(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return (
    normalized.includes("clipboard is unavailable") ||
    normalized.includes("no clipboard") ||
    normalized.includes("cannot open display") ||
    normalized.includes("can't open display") ||
    normalized.includes("no display") ||
    normalized.includes("wayland display") ||
    normalized.includes("x11") ||
    normalized.includes("x server") ||
    normalized.includes("dbus") ||
    normalized.includes("session bus")
  );
}

function isPermissionDenied(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return (
    normalized.includes("permission") ||
    normalized.includes("denied") ||
    normalized.includes("not authorized")
  );
}

async function readStreamText(stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> {
  if (!stream) {
    return "";
  }

  return new Response(stream).text();
}

async function runClipboardCommand(
  command: string[],
  timeoutMs: number
): Promise<ClipboardCommandResult> {
  const process = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ kind: "timeout" }>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ kind: "timeout" });
    }, timeoutMs);
  });

  const exitedPromise = process.exited.then((exitCode) => ({ kind: "exit" as const, exitCode }));
  const result = await Promise.race([exitedPromise, timeoutPromise]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  if (result.kind === "timeout") {
    process.kill();
    return {
      exitCode: 1,
      stdout: "",
      stderr: `clipboard backend timed out after ${timeoutMs}ms`,
      timedOut: true,
    };
  }

  const [stdout, stderr] = await Promise.all([
    readStreamText(process.stdout),
    readStreamText(process.stderr),
  ]);

  return {
    exitCode: result.exitCode,
    stdout,
    stderr,
    timedOut: false,
  };
}

function normalizeClipboardReadError(error: unknown): IngestFileError {
  if (error instanceof IngestFileError) {
    return error;
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (isCommandUnavailable(message) || isClipboardUnavailable(message)) {
    return new IngestFileError(
      "CLIPBOARD_UNAVAILABLE",
      "Clipboard is unavailable on this system"
    );
  }

  if (isPermissionDenied(message)) {
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

async function readSystemClipboard(options: ReadSystemClipboardOptions): Promise<string> {
  const candidates = commandCandidatesForPlatform(options.platform);
  let sawUnavailable = false;
  let sawPermissionDenied = false;
  let sawFailure = false;

  for (const candidate of candidates) {
    const result = await options.runClipboardCommand(candidate, options.timeoutMs);

    if (result.exitCode === 0) {
      return result.stdout;
    }

    const stderr = result.stderr.trim();

    if (result.timedOut) {
      sawFailure = true;
      continue;
    }

    if (isCommandUnavailable(stderr) || isClipboardUnavailable(stderr)) {
      sawUnavailable = true;
      continue;
    }

    if (isPermissionDenied(stderr)) {
      sawPermissionDenied = true;
      continue;
    }

    sawFailure = true;
  }

  if (sawPermissionDenied) {
    throw new IngestFileError("CLIPBOARD_PERMISSION_DENIED", "Clipboard access denied");
  }

  if (sawUnavailable && !sawFailure) {
    throw new IngestFileError(
      "CLIPBOARD_UNAVAILABLE",
      "Clipboard is unavailable on this system"
    );
  }

  throw new IngestFileError("CLIPBOARD_READ_FAILED", "Failed to read clipboard");
}

export async function readClipboard(options: ReadClipboardOptions = {}): Promise<Document> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const platform = options.platform ?? process.platform;
  const backendTimeoutMs = options.backendTimeoutMs ?? DEFAULT_CLIPBOARD_COMMAND_TIMEOUT_MS;
  const runCommand = options.runClipboardCommand ?? runClipboardCommand;
  const readText =
    options.readText ??
    globalThis.__RFAF_TEST_READ_CLIPBOARD__ ??
    (() =>
      readSystemClipboard({
        platform,
        timeoutMs: backendTimeoutMs,
        runClipboardCommand: runCommand,
      }));

  try {
    const content = await readText();

    if (!content.trim()) {
      throw new IngestFileError("CLIPBOARD_EMPTY", "Clipboard is empty");
    }

    const byteLength = Buffer.byteLength(content, "utf8");
    assertInputWithinLimit(byteLength, maxBytes);

    return {
      content,
      source: "clipboard",
      wordCount: countWords(content),
    };
  } catch (error: unknown) {
    throw normalizeClipboardReadError(error);
  }
}
