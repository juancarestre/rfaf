#!/usr/bin/env bun

import { closeSync, fstatSync, openSync } from "node:fs";
import { ReadStream } from "node:tty";
import { render, Text } from "ink";
import { useEffect, useState } from "react";

const WORDS = [
  "focus",
  "clarity",
  "velocity",
  "reading",
  "comprehension",
  "momentum",
  "attention",
  "flow",
];

const INTERVAL_MS = 120; // ~500 WPM
const DURATION_MS = 4000;

function useAlternateScreen(): boolean {
  try {
    return fstatSync(1).isCharacterDevice();
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

function createInteractiveInput() {
  try {
    const fd = openSync("/dev/tty", "r");
    const tty = new ReadStream(fd);
    return {
      stdin: tty,
      cleanup: () => {
        tty.destroy();
        try {
          closeSync(fd);
        } catch {
          // fd may already be closed
        }
      },
    };
  } catch {
    return {
      stdin: undefined,
      cleanup: () => {},
    };
  }
}

function SpikeApp({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((value) => value + 1);
    }, INTERVAL_MS);

    const done = setTimeout(() => {
      clearInterval(interval);
      onComplete();
    }, DURATION_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [onComplete]);

  const word = WORDS[index % WORDS.length];
  return <Text>{`Spike @ ${INTERVAL_MS}ms: ${word}`}</Text>;
}

async function main() {
  const alt = useAlternateScreen();
  if (alt) enterAlternateScreen();

  const input = createInteractiveInput();
  let renderCount = 0;

  const app = render(
    <SpikeApp
      onComplete={() => {
        app.unmount();
      }}
    />,
    {
      stdin: input.stdin,
      maxFps: 60,
      incrementalRendering: true,
      patchConsole: true,
      onRender: () => {
        renderCount += 1;
      },
    }
  );

  try {
    await app.waitUntilExit();
  } finally {
    input.cleanup();
    if (alt) exitAlternateScreen();
  }

  const targetUpdates = Math.floor(DURATION_MS / INTERVAL_MS);
  console.log(`Ink spike complete: ${renderCount} renders, ~${targetUpdates} target updates.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
