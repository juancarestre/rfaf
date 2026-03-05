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
    stream.write(`\r${frame} ${safeMessage}`);
  };

  const clearFrame = () => {
    stream.write("\r\x1b[2K");
  };

  return {
    start: () => {
      if (active) return;
      active = true;

      if (!stream.isTTY) {
        writeLine(stream, `Summarizing: ${safeMessage}`);
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
      const safe = sanitizeTerminalText(message ?? "Summary ready.");
      if (stream.isTTY) {
        clearFrame();
      }
      writeLine(stream, `[ok] ${safe}`);
    },

    fail: (message?: string) => {
      const safe = sanitizeTerminalText(message ?? "Summarization failed.");
      if (stream.isTTY) {
        clearFrame();
      }
      writeLine(stream, `[error] ${safe}`);
    },
  };
}
