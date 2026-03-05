#!/usr/bin/env bun

import { render } from "ink";
import { closeSync, fstatSync, openSync } from "node:fs";
import { ReadStream } from "node:tty";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readPlaintextFile } from "../ingest/plaintext";
import { isStdinPiped, resolveInputSource } from "../ingest/detect";
import { readStdin } from "../ingest/stdin";
import { tokenize } from "../processor/tokenizer";
import { App } from "../ui/App";

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
    throw new Error("Invalid --wpm value. It must be an integer.");
  }

  if (value < 50 || value > 1500) {
    throw new Error("Invalid --wpm value. It must be between 50 and 1500.");
  }

  return value;
}

async function main() {
  const parser = yargs(hideBin(process.argv))
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
    .help()
    .version()
    .strict(false);

  const argv = await parser.parse();

  let fileArg: string | undefined;
  if (typeof argv._[0] === "string") {
    fileArg = argv._[0];
  }

  const wpm = parseWpm(argv.wpm);

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

  const words = tokenize(document.content);

  const alternateScreen = useAlternateScreen();
  if (alternateScreen) {
    enterAlternateScreen();
  }

  const input = getInteractiveInputStream();

  if (!input.stdin) {
    throw new Error(
      "Interactive terminal input is required to run rfaf. Please run in a TTY terminal."
    );
  }

  const app = render(
    <App words={words} initialWpm={wpm} sourceLabel={document.source} />,
    {
      stdin: input.stdin,
      exitOnCtrlC: true,
      patchConsole: true,
      maxFps: 60,
      incrementalRendering: true,
    }
  );

  try {
    await app.waitUntilExit();
  } finally {
    input.cleanup();
    if (alternateScreen) {
      exitAlternateScreen();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);

  if (message.includes("--wpm")) {
    process.exit(2);
  }

  process.exit(1);
});
