import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";

const FRAMES = ["-", "\\", "|", "/"];

interface LoadingIndicatorOptions {
  message: string;
  stream?: NodeJS.WriteStream;
  intervalMs?: number;
}

export interface LoadingIndicator {
  start: () => void;
  stop: () => void;
  succeed: (message?: string) => void;
  fail: (message?: string) => void;
}

function writeLine(stream: NodeJS.WriteStream, text: string): void {
  stream.write(`${text}\n`);
}

function truncateSingleLine(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return ".".repeat(maxChars);
  return `${text.slice(0, maxChars - 3)}...`;
}

export function createLoadingIndicator(options: LoadingIndicatorOptions): LoadingIndicator {
  const stream = options.stream ?? process.stderr;
  const intervalMs = options.intervalMs ?? 80;
  const safeMessage = sanitizeTerminalText(options.message);

  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let active = false;

  const renderFrame = () => {
    const frame = FRAMES[frameIndex % FRAMES.length];
    frameIndex += 1;
    const columns = stream.columns ?? 80;
    const maxMessageLength = Math.max(1, columns - 3);
    const singleLineMessage = truncateSingleLine(safeMessage, maxMessageLength);
    stream.write(`\r${frame} ${singleLineMessage}`);
  };

  const clearFrame = () => {
    stream.write("\r\x1b[2K");
  };

  return {
    start: () => {
      if (active) return;
      active = true;

      if (!stream.isTTY) {
        writeLine(stream, safeMessage);
        return;
      }

      renderFrame();
      timer = setInterval(renderFrame, intervalMs);
    },

    stop: () => {
      if (!active) return;
      active = false;

      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      if (stream.isTTY) {
        clearFrame();
      }
    },

    succeed: (message?: string) => {
      if (active) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        active = false;
      }
      const safe = sanitizeTerminalText(message ?? "Summary ready.");
      if (stream.isTTY) {
        clearFrame();
      }
      writeLine(stream, `[ok] ${safe}`);
    },

    fail: (message?: string) => {
      if (active) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        active = false;
      }
      const safe = sanitizeTerminalText(message ?? "Summarization failed.");
      if (stream.isTTY) {
        clearFrame();
      }
      writeLine(stream, `[error] ${safe}`);
    },
  };
}
