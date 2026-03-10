#!/usr/bin/env bun

import { render } from "ink";
import { closeSync, fstatSync, openSync } from "node:fs";
import { ReadStream } from "node:tty";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createLoadingIndicator } from "./loading-indicator";
import { readFileSource } from "../ingest/file-dispatcher";
import { isStdinPiped, resolveInputSource } from "../ingest/detect";
import { readStdin } from "../ingest/stdin";
import { readUrl } from "../ingest/url";
import { readClipboard } from "../ingest/clipboard";
import type { Document } from "../ingest/types";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { App } from "../ui/App";
import { SummarizeRuntimeError, UsageError, UserCancelledError } from "./errors";
import {
  KEY_PHRASES_OUTPUT_MODES,
  resolveKeyPhrasesOption,
  wasKeyPhrasesFlagProvided,
} from "./key-phrases-option";
import {
  DEFAULT_READING_MODE,
  READING_MODES,
  resolveReadingMode,
  wasModeFlagProvided,
} from "./mode-option";
import { resolveNoBsOption } from "./no-bs-option";
import { resolveQuizOption } from "./quiz-option";
import { runStandaloneQuiz } from "./quiz-flow";
import {
  buildReadingPipeline,
  buildTransformedContentPipeline,
} from "./reading-pipeline";
import { runSessionLifecycle } from "./session-lifecycle";
import {
  resolveStrategyOption,
  validateStrategyArgs,
} from "./strategy-option";
import {
  resolveSummaryOption,
  SUMMARY_PRESETS,
  wasSummaryFlagProvided,
} from "./summary-option";
import { resolveModeAfterStrategy, strategyBeforeRsvp } from "./strategy-flow";
import {
  DEFAULT_TEXT_SCALE,
  resolveTextScale,
  TEXT_SCALE_PRESETS,
} from "./text-scale-option";
import {
  resolveTranslateOption,
  wasTranslateFlagProvided,
} from "./translate-option";

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

    normalized.push(`--summary=${next}`);
    index += 1;
  }

  return normalized;
}

function normalizeTranslateArgs(rawArgs: string[]): string[] {
  const normalized: string[] = [];

  const isLikelyInputPathOrUrl = (value: string): boolean => {
    const candidate = value.trim();
    if (!candidate) {
      return true;
    }

    if (/^https?:\/\//i.test(candidate)) {
      return true;
    }

    if (candidate.includes("/") || candidate.includes("\\") || candidate.includes(".")) {
      return true;
    }

    return false;
  };

  for (let index = 0; index < rawArgs.length; index++) {
    const token = rawArgs[index];

    if (token === "--translate-to") {
      const next = rawArgs[index + 1];

      if (next === undefined || next.startsWith("-") || isLikelyInputPathOrUrl(next)) {
        normalized.push("--translate-to=");
        continue;
      }

      normalized.push(`--translate-to=${next}`);
      index += 1;
      continue;
    }

    if (token.startsWith("--translate-to=")) {
      normalized.push(token);
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function normalizeKeyPhrasesArgs(rawArgs: string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < rawArgs.length; index++) {
    const token = rawArgs[index];

    if (token === "--key-phrases") {
      const next = rawArgs[index + 1];

      if (next === undefined || next.startsWith("-")) {
        normalized.push("--key-phrases=");
        continue;
      }

      const normalizedMode = next.trim().toLowerCase();
      if (KEY_PHRASES_OUTPUT_MODES.includes(normalizedMode as (typeof KEY_PHRASES_OUTPUT_MODES)[number])) {
        normalized.push(`--key-phrases=${next}`);
        index += 1;
        continue;
      }

      normalized.push("--key-phrases=");
      continue;
    }

    if (token.startsWith("--key-phrases=")) {
      normalized.push(token);
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

function validateNoBsArgs(rawArgs: string[]): void {
  for (const token of rawArgs) {
    if (token.startsWith("--no-bs=")) {
      throw new UsageError("Invalid --no-bs value. Use --no-bs without a value.");
    }

    if (token === "--no-no-bs" || token.startsWith("--no-no-bs=")) {
      throw new UsageError("Invalid --no-bs value. Use --no-bs without a value.");
    }
  }
}

function validateQuizArgs(rawArgs: string[]): void {
  for (const token of rawArgs) {
    if (token.startsWith("--quiz=")) {
      throw new UsageError("Invalid --quiz value. Use --quiz without a value.");
    }

    if (token === "--no-quiz" || token.startsWith("--no-quiz=")) {
      throw new UsageError("Invalid --quiz value. Use --quiz without a value.");
    }
  }
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
  validateNoBsArgs(rawArgs);
  validateQuizArgs(rawArgs);
  validateStrategyArgs(rawArgs);
  const normalizedArgs = normalizeKeyPhrasesArgs(
    normalizeTranslateArgs(normalizeSummaryArgs(rawArgs))
  );
  const parser = yargs(normalizedArgs)
    .scriptName("rfaf")
    .usage("$0 [input] [options]")
    .positional("input", {
      type: "string",
      describe: "Plaintext/PDF/EPUB/Markdown file path or article URL (http/https)",
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
    .option("no-bs", {
      type: "boolean",
      default: false,
      describe: "Clean low-value noise and keep high-signal content",
    })
    .option("translate-to", {
      type: "string",
      describe: "Translate content to a target language (e.g. es, pt-BR, english)",
    })
    .option("key-phrases", {
      type: "string",
      describe: `Extract key phrases before reading (${KEY_PHRASES_OUTPUT_MODES.join("|")}); bare --key-phrases uses preview`,
    })
    .option("quiz", {
      type: "boolean",
      default: false,
      describe: "Run a standalone retention quiz after text transforms",
    })
    .option("strategy", {
      type: "boolean",
      default: false,
      describe: "Recommend best reading mode before reading (advisory only)",
    })
    .option("clipboard", {
      type: "boolean",
      default: false,
      describe: "Read plain text from system clipboard",
    })
    .option("mode", {
      type: "string",
      default: DEFAULT_READING_MODE,
      describe: `Reading mode (${READING_MODES.join("|")})`,
    })
    .requiresArg("text-scale")
    .requiresArg("mode")
    .example("$0 https://example.com/article", "Fetch and speed-read a web article")
    .example("cat article.txt | $0", "Read piped plaintext from stdin")
    .example("$0 --clipboard", "Read copied plain text from clipboard")
    .example("$0 --no-bs article.txt", "Clean noisy text before reading")
    .example(
      "$0 article.txt --summary=medium --mode=scroll",
      "Summarize then read in scroll mode"
    )
    .epilog(
      "Runtime controls: Space play/pause, Left/Right seek, Up/Down WPM, 1-4 switch mode, ? help, q quit"
    )
    .exitProcess(false)
    .help()
    .version()
    .parserConfiguration({
      "boolean-negation": false,
    })
    .strict(false);

  const argv = await parser.parse();

  let fileArg: string | undefined;
  if (typeof argv._[0] === "string") {
    fileArg = argv._[0];
  }

  const wpm = parseWpm(argv.wpm);
  const textScale = resolveTextScale(argv.textScale);
  const mode = resolveReadingMode(argv.mode);
  const modeFlagProvided = wasModeFlagProvided(normalizedArgs);
  const noBsOption = resolveNoBsOption(argv.noBs ?? argv["no-bs"]);
  const quizOption = resolveQuizOption(argv.quiz);
  const strategyOption = resolveStrategyOption(argv.strategy);
  const summaryOption = resolveSummaryOption(
    argv.summary,
    wasSummaryFlagProvided(normalizedArgs)
  );
  const translateOption = resolveTranslateOption(
    argv["translate-to"],
    wasTranslateFlagProvided(normalizedArgs)
  );
  const keyPhrasesOption = resolveKeyPhrasesOption(
    argv["key-phrases"],
    wasKeyPhrasesFlagProvided(normalizedArgs)
  );

  if (argv.help || argv.version) {
    return;
  }

  if (quizOption.enabled && !process.stdout.isTTY) {
    throw new UsageError("Interactive terminal output is required for --quiz.");
  }

  const stdinIsPiped = isStdinPiped();

  if (argv.clipboard) {
    if (fileArg) {
      if (/^https?:\/\//i.test(fileArg)) {
        throw new UsageError("Cannot combine --clipboard with URL input");
      }
      throw new UsageError("Cannot combine --clipboard with file input");
    }

    if (stdinIsPiped) {
      throw new UsageError("Cannot combine --clipboard with piped stdin");
    }
  }

  const source = argv.clipboard
    ? ({ kind: "clipboard" } as const)
    : resolveInputSource({
        fileArg,
        stdinIsPiped,
      });

  if (source.kind === "none") {
    parser.showHelp();
    process.exit(0);
  }

  const pendingWarning =
    source.kind === "file" || source.kind === "url" ? source.warning : undefined;

  let document: Document;
  if (source.kind === "file") {
    document = await readFileSource(source.path);
  } else if (source.kind === "url") {
    const loading = createLoadingIndicator({
      message: `fetching article from ${source.url}`,
    });
    const abortController = new AbortController();
    const onSigInt = () => {
      abortController.abort(new Error("SIGINT"));
    };

    process.once("SIGINT", onSigInt);
    loading.start();
    try {
      document = await readUrl(source.url, { signal: abortController.signal });
      loading.stop();
      loading.succeed(`article loaded: ${document.source} (${document.wordCount} words)`);
    } catch (error: unknown) {
      loading.stop();
      loading.fail("failed to fetch article");
      throw error;
    } finally {
      process.removeListener("SIGINT", onSigInt);
    }
  } else if (source.kind === "stdin") {
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
  } else {
    document = await readClipboard();
  }

  if (pendingWarning) {
    process.stderr.write(`${pendingWarning}\n`);
  }

  if (quizOption.enabled) {
    const transformed = await buildTransformedContentPipeline({
      documentContent: document.content,
      sourceLabel: document.source,
      noBsOption,
      summaryOption,
      translateOption,
    });

    const { stdin: quizStdin, cleanup } = getInteractiveInputStream();

    try {
      if (!quizStdin) {
        throw new UsageError("Interactive terminal input is required for --quiz.");
      }

      await runStandaloneQuiz({
        documentContent: transformed.readingContent,
        sourceLabel: transformed.sourceLabel,
        quizOption,
        inputStream: quizStdin,
        outputStream: process.stdout,
      });
    } finally {
      cleanup();
    }

    return;
  }

  const strategyResult = await strategyBeforeRsvp({
    documentContent: document.content,
    strategyOption,
    selectedMode: mode,
    explicitModeProvided: modeFlagProvided,
  });

  if (strategyResult.warning) {
    process.stderr.write(`[warn] ${strategyResult.warning}\n`);
  }

  const effectiveMode = resolveModeAfterStrategy({
    selectedMode: mode,
    explicitModeProvided: modeFlagProvided,
    recommendedMode: strategyResult.recommendedMode,
  });

  const readingPipeline = await buildReadingPipeline({
    documentContent: document.content,
    sourceLabel: document.source,
    noBsOption,
    summaryOption,
    translateOption,
    keyPhrasesOption,
    mode: effectiveMode,
  });

  if (keyPhrasesOption.enabled && keyPhrasesOption.mode === "list") {
    const phrases = readingPipeline.keyPhrases;
    process.stdout.write(`Key phrases (${phrases.length}):\n`);
    for (const phrase of phrases) {
      process.stdout.write(`- ${sanitizeTerminalText(phrase)}\n`);
    }
    return;
  }

  const sourceWords = readingPipeline.sourceWords;
  const sourceLabel = readingPipeline.sourceLabel;

  await runSessionLifecycle({
    useAlternateScreen: useAlternateScreen(),
    getInputStream: getInteractiveInputStream,
    enterAlternateScreen,
    exitAlternateScreen,
    renderApp: (stdin) =>
      render(
        <App
          sourceWords={sourceWords}
          initialWpm={wpm}
          sourceLabel={sourceLabel}
          textScale={textScale}
          initialMode={effectiveMode}
          keyPhrasePreview={readingPipeline.keyPhrases}
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
  if (error instanceof UserCancelledError) {
    process.exit(130);
  }

  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = redactSecrets(
    message,
    process.env as Record<string, string | undefined>
  );
  const renderedMessage = sanitizeTerminalText(safeMessage);
  process.stderr.write(`${renderedMessage}\n`);

  if (error instanceof UsageError) {
    process.exit(2);
  }

  if (
    renderedMessage.includes("--wpm") ||
    renderedMessage.includes("text-scale") ||
    renderedMessage.includes("--summary") ||
    renderedMessage.includes("--mode") ||
    renderedMessage.includes("--strategy") ||
    renderedMessage.includes("--translate-to") ||
    renderedMessage.includes("--key-phrases") ||
    renderedMessage.startsWith("Config error:")
  ) {
    process.exit(2);
  }

  process.exit(1);
});
