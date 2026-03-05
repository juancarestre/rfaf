#!/usr/bin/env bun

import { render } from "ink";
import { closeSync, existsSync, fstatSync, openSync } from "node:fs";
import { ReadStream } from "node:tty";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readPlaintextFile } from "../ingest/plaintext";
import { isStdinPiped, resolveInputSource } from "../ingest/detect";
import { readStdin } from "../ingest/stdin";
import { tokenize } from "../processor/tokenizer";
import { App } from "../ui/App";
import { SummarizeRuntimeError, UsageError } from "./errors";
import { runSessionLifecycle } from "./session-lifecycle";
import { summarizeBeforeRsvp } from "./summarize-flow";
import {
  resolveSummaryOption,
  SUMMARY_PRESETS,
  wasSummaryFlagProvided,
} from "./summary-option";
import {
  DEFAULT_TEXT_SCALE,
  resolveTextScale,
  TEXT_SCALE_PRESETS,
} from "./text-scale-option";

function useAlternateScreen(): boolean {
  if (process.env.RFAF_NO_ALT_SCREEN === "1") {
    return false;
  }

  try {
    return fstatSync(1).isCharacterDevice();
  } catch {
    return false;
  }
}

function hasInteractiveStdin(): boolean {
  try {
    return fstatSync(0).isCharacterDevice();
  } catch {
    return false;
  }
}

function enterAlternateScreen() {
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[?25l");
}

function exitAlternateScreen() {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[?1049l");
}

function getInteractiveInputStream(): {
  stdin?: NodeJS.ReadStream;
  cleanup: () => void;
} {
  if (hasInteractiveStdin()) {
    const nativeStdin = process.stdin as NodeJS.ReadStream & {
      setRawMode?: (mode: boolean) => void;
    };

    if (typeof nativeStdin.setRawMode === "function") {
      return { stdin: nativeStdin, cleanup: () => {} };
    }

    const ttyStdin = new ReadStream(0);
    return {
      stdin: ttyStdin,
      cleanup: () => {
        ttyStdin.destroy();
      },
    };
  }

  try {
    const fd = openSync("/dev/tty", "r");
    const ttyStdin = new ReadStream(fd);

    return {
      stdin: ttyStdin,
      cleanup: () => {
        ttyStdin.destroy();
        try {
          closeSync(fd);
        } catch {
          // fd might already be closed by stream destruction
        }
      },
    };
  } catch {
    return { cleanup: () => {} };
  }
}

function parseWpm(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new UsageError("Invalid --wpm value. It must be an integer.");
  }

  if (value < 50 || value > 1500) {
    throw new UsageError("Invalid --wpm value. It must be between 50 and 1500.");
  }

  return value;
}

function normalizeSummaryArgs(rawArgs: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < rawArgs.length; index++) {
    const token = rawArgs[index];

    if (token !== "--summary") {
      normalized.push(token);
      continue;
    }

    const next = rawArgs[index + 1];
    if (next === undefined || next.startsWith("-")) {
      normalized.push("--summary=");
      continue;
    }

    const normalizedPreset = next.trim().toLowerCase();
    if (SUMMARY_PRESETS.includes(normalizedPreset as (typeof SUMMARY_PRESETS)[number])) {
      normalized.push(`--summary=${next}`);
      index += 1;
      continue;
    }

    if (existsSync(next)) {
      normalized.push("--summary=");
      continue;
    }

    normalized.push(`--summary=${next}`);
    index += 1;
  }

  return normalized;
}

function redactSecrets(
  message: string,
  env: Record<string, string | undefined>
): string {
  let safe = message;
  const candidates = [
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
    env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((value): value is string => Boolean(value && value.length >= 8));

  for (const secret of candidates) {
    safe = safe.split(secret).join("[REDACTED]");
  }

  return safe.replace(/(sk|AIza)[A-Za-z0-9_\-]{8,}/g, "[REDACTED]");
}

async function main() {
  const rawArgs = hideBin(process.argv);
  const normalizedArgs = normalizeSummaryArgs(rawArgs);
  const parser = yargs(normalizedArgs)
    .scriptName("rfaf")
    .usage("$0 [file] [options]")
    .positional("file", {
      type: "string",
      describe: "Plaintext file to read",
    })
    .option("wpm", {
      type: "number",
      default: 300,
      describe: "Initial speed (50-1500)",
    })
    .option("text-scale", {
      type: "string",
      default: DEFAULT_TEXT_SCALE,
      describe: `Text readability scale (${TEXT_SCALE_PRESETS.join("|")})`,
    })
    .option("summary", {
      type: "string",
      describe: `Summarize before reading (${SUMMARY_PRESETS.join("|")}); bare --summary uses medium`,
    })
    .requiresArg("text-scale")
    .exitProcess(false)
    .help()
    .version()
    .strict(false);

  const argv = await parser.parse();

  let fileArg: string | undefined;
  if (typeof argv._[0] === "string") {
    fileArg = argv._[0];
  }

  const wpm = parseWpm(argv.wpm);
  const textScale = resolveTextScale(argv.textScale);
  const summaryOption = resolveSummaryOption(
    argv.summary,
    wasSummaryFlagProvided(normalizedArgs)
  );

  if (argv.help || argv.version) {
    return;
  }

  const source = resolveInputSource({
    fileArg,
    stdinIsPiped: isStdinPiped(),
  });

  if (source.kind === "none") {
    parser.showHelp();
    process.exit(0);
  }

  const pendingWarning = source.kind === "file" ? source.warning : undefined;

  let document: Awaited<ReturnType<typeof readPlaintextFile>>;
  if (source.kind === "file") {
    document = await readPlaintextFile(source.path);
  } else {
    try {
      document = await readStdin();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "File is empty") {
        parser.showHelp();
        process.exit(0);
      }
      throw error;
    }
  }

  if (pendingWarning) {
    process.stderr.write(`${pendingWarning}\n`);
  }

  const summaryResult = await summarizeBeforeRsvp({
    documentContent: document.content,
    sourceLabel: document.source,
    summaryOption,
  });

  const readingContent = summaryResult.readingContent;
  const sourceLabel = summaryResult.sourceLabel;

  const words = tokenize(readingContent);

  await runSessionLifecycle({
    useAlternateScreen: useAlternateScreen(),
    getInputStream: getInteractiveInputStream,
    enterAlternateScreen,
    exitAlternateScreen,
    renderApp: (stdin) =>
      render(
        <App
          words={words}
          initialWpm={wpm}
          sourceLabel={sourceLabel}
          textScale={textScale}
        />,
        {
          stdin,
          exitOnCtrlC: true,
          patchConsole: true,
          maxFps: 60,
          incrementalRendering: true,
        }
      ),
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = redactSecrets(
    message,
    process.env as Record<string, string | undefined>
  );
  process.stderr.write(`${safeMessage}\n`);

  if (error instanceof UsageError) {
    process.exit(2);
  }

  if (
    safeMessage.includes("--wpm") ||
    safeMessage.includes("text-scale") ||
    safeMessage.includes("--summary") ||
    safeMessage.startsWith("Config error:")
  ) {
    process.exit(2);
  }

  process.exit(1);
});
