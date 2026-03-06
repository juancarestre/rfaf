import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { ReadingMode } from "../../cli/mode-option";
import { getDisplayTime } from "../../processor/pacer";
import type { Word } from "../../processor/types";
import {
  computeLineMap,
  getFirstWordIndexForLine,
  getLineForWordIndex,
} from "../../processor/line-computation";
import { getLineDwellTime } from "../../processor/scroll-line-pacer";
import {
  adjustWpm,
  advancePlayback,
  createReader,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
  restartReader,
  stepForward,
  togglePlayPause,
  type Reader,
} from "../../engine/reader";
import {
  createSession,
  finishSession,
  markPaused,
  markPlayStarted,
  markWordAdvanced,
  type Session,
} from "../../engine/session";
import { HelpOverlay } from "../components/HelpOverlay";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBar } from "../components/StatusBar";
import { getTextScaleConfig, type TextScalePreset } from "../text-scale";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface GuidedScrollScreenProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
  mode: ReadingMode;
}

function getLiveReadingTimeMs(session: Session): number {
  if (session.lastPlayStartMs === null) return session.totalReadingTimeMs;
  return session.totalReadingTimeMs + (Date.now() - session.lastPlayStartMs);
}

function buildRemainingSecondsLookup(words: Word[], currentWpm: number): number[] {
  const lookup = new Array<number>(words.length + 1).fill(0);
  if (words.length === 0) return lookup;

  let suffixMs = 0;
  for (let index = words.length - 1; index >= 0; index--) {
    const word = words[index];
    if (!word) continue;
    suffixMs += getDisplayTime(word, currentWpm);
    lookup[index] = Math.round(suffixMs / 1000);
  }

  return lookup;
}

function applyReaderAndSession(
  currentReader: Reader,
  currentSession: Session,
  nextReader: Reader
): Session {
  const now = Date.now();
  let nextSession = currentSession;

  if (currentReader.state !== "playing" && nextReader.state === "playing") {
    nextSession = markPlayStarted(nextSession, now);
  }

  if (currentReader.state === "playing" && nextReader.state !== "playing") {
    nextSession = markPaused(nextSession, now);
  }

  if (
    currentReader.state === "playing" &&
    nextReader.currentIndex > currentReader.currentIndex
  ) {
    const steps = nextReader.currentIndex - currentReader.currentIndex;
    for (let i = 0; i < steps; i++) {
      nextSession = markWordAdvanced(nextSession);
    }
  }

  if (nextSession.currentWpm !== nextReader.currentWpm) {
    nextSession = { ...nextSession, currentWpm: nextReader.currentWpm };
  }

  if (currentReader.state !== "finished" && nextReader.state === "finished") {
    nextSession = finishSession(nextSession, now);
  }

  return nextSession;
}

/**
 * Build text for a single line from its constituent words.
 */
function buildLineText(words: Word[], startIdx: number, endIdx: number): string {
  const parts: string[] = [];
  for (let i = startIdx; i <= endIdx && i < words.length; i++) {
    parts.push(sanitizeTerminalText(words[i]!.text));
  }
  return parts.join(" ");
}

/**
 * Step reader to the first word of the next line (forward by one scroll unit).
 */
function stepForwardByLine(reader: Reader, lineMap: ReturnType<typeof computeLineMap>): Reader {
  if (reader.state === "finished") return reader;
  const paused: Reader =
    reader.state === "playing" ? { ...reader, state: "paused" } : reader;

  const currentLine = getLineForWordIndex(lineMap, paused.currentIndex);
  const nextLine = currentLine + 1;

  if (nextLine >= lineMap.totalLines) {
    // At last line -- clamp to end
    const lastIdx = paused.words.length - 1;
    if (paused.currentIndex >= lastIdx) return paused;
    return { ...paused, currentIndex: lastIdx };
  }

  return { ...paused, currentIndex: getFirstWordIndexForLine(lineMap, nextLine) };
}

/**
 * Step reader to the first word of the previous line (backward by one scroll unit).
 */
function stepBackwardByLine(reader: Reader, lineMap: ReturnType<typeof computeLineMap>): Reader {
  if (reader.state === "finished") return reader;
  const paused: Reader =
    reader.state === "playing" ? { ...reader, state: "paused" } : reader;

  const currentLine = getLineForWordIndex(lineMap, paused.currentIndex);

  if (currentLine <= 0) {
    if (paused.currentIndex === 0) return paused;
    return { ...paused, currentIndex: 0 };
  }

  return { ...paused, currentIndex: getFirstWordIndexForLine(lineMap, currentLine - 1) };
}

export function GuidedScrollScreen({
  words,
  initialWpm,
  sourceLabel,
  textScale,
  mode,
}: GuidedScrollScreenProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState(() => ({
    width: stdout.columns ?? 80,
    height: stdout.rows ?? 24,
  }));
  const [reader, setReader] = useState(() => createReader(words, initialWpm));
  const [session, setSession] = useState(() => createSession(initialWpm));
  const [helpVisible, setHelpVisible] = useState(false);
  const textScaleConfig = getTextScaleConfig(textScale);

  useEffect(() => {
    const onResize = () => {
      setTerminalSize({
        width: stdout.columns ?? 80,
        height: stdout.rows ?? 24,
      });
    };

    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const width = terminalSize.width;
  const height = terminalSize.height;
  const tooSmall = width < 40 || height < 8;

  // Precomputed line map -- recomputed on resize or word change
  const lineMap = useMemo(
    () => computeLineMap(words, width),
    [words, width]
  );

  const updateReader = (transform: (reader: Reader) => Reader) => {
    setReader((currentReader) => {
      const nextReader = transform(currentReader);
      setSession((currentSession) =>
        applyReaderAndSession(currentReader, currentSession, nextReader)
      );
      return nextReader;
    });
  };

  useEffect(() => {
    if (tooSmall && reader.state === "playing") {
      updateReader(togglePlayPause);
    }
  }, [tooSmall, reader.state]);

  // Auto-advance: schedule next word tick using per-word display time
  useEffect(() => {
    if (reader.state !== "playing" || helpVisible || tooSmall) return;

    const word = words[reader.currentIndex];
    if (!word) return;

    const delay = Math.max(1, Math.round(getDisplayTime(word, reader.currentWpm)));
    const timer = setTimeout(() => {
      updateReader(advancePlayback);
    }, delay);

    return () => clearTimeout(timer);
  }, [
    helpVisible,
    reader.currentIndex,
    reader.currentWpm,
    reader.state,
    tooSmall,
    words,
  ]);

  // Keybindings
  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (helpVisible) {
      if (input === "?" || key.escape) {
        setHelpVisible(false);
      }
      return;
    }

    if (input === "?") {
      if (reader.state === "playing") {
        updateReader(togglePlayPause);
      }
      setHelpVisible(true);
      return;
    }

    if (input === " ") {
      updateReader(togglePlayPause);
      return;
    }

    if (input === "r") {
      setReader((currentReader) => {
        const restarted = restartReader(currentReader);
        setSession(createSession(restarted.currentWpm));
        return restarted;
      });
      return;
    }

    // Step by LINE (scroll unit), not by word
    if (input === "l" || key.rightArrow) {
      updateReader((r) => stepForwardByLine(r, lineMap));
      return;
    }

    if (input === "h" || key.leftArrow) {
      updateReader((r) => stepBackwardByLine(r, lineMap));
      return;
    }

    if (input === "k" || key.upArrow) {
      updateReader((currentReader) => adjustWpm(currentReader, 25));
      return;
    }

    if (input === "j" || key.downArrow) {
      updateReader((currentReader) => adjustWpm(currentReader, -25));
      return;
    }

    if (input === "p") {
      updateReader(jumpToNextParagraph);
      return;
    }

    if (input === "b") {
      updateReader(jumpToPreviousParagraph);
    }
  });

  // Derive current line from currentIndex
  const currentLine = getLineForWordIndex(lineMap, reader.currentIndex);

  // Calculate visible line window
  // Reserve 3 lines for status bar, progress bar, and padding
  const chromeLines = 3;
  const availableLines = Math.max(1, height - chromeLines);

  // Determine visible window: keep current line near center when possible
  let visibleStart: number;
  if (lineMap.totalLines <= availableLines) {
    // All lines fit -- show everything
    visibleStart = 0;
  } else if (currentLine < Math.floor(availableLines / 2)) {
    // Near the top -- start from 0
    visibleStart = 0;
  } else if (currentLine > lineMap.totalLines - Math.ceil(availableLines / 2)) {
    // Near the bottom -- show last N lines
    visibleStart = Math.max(0, lineMap.totalLines - availableLines);
  } else {
    // Center the current line
    visibleStart = currentLine - Math.floor(availableLines / 2);
  }
  const visibleEnd = Math.min(lineMap.totalLines - 1, visibleStart + availableLines - 1);

  // Build visible line elements
  const lineElements: { text: string; isCurrentLine: boolean }[] = [];
  for (let line = visibleStart; line <= visibleEnd; line++) {
    const firstWordIdx = getFirstWordIndexForLine(lineMap, line);
    const lastWordIdx =
      line < lineMap.totalLines - 1
        ? getFirstWordIndexForLine(lineMap, line + 1) - 1
        : words.length - 1;

    lineElements.push({
      text: buildLineText(words, firstWordIdx, lastWordIdx),
      isCurrentLine: line === currentLine,
    });
  }

  const progress = useMemo(() => {
    if (words.length <= 1) return 1;
    return reader.currentIndex / (words.length - 1);
  }, [reader.currentIndex, words.length]);

  const remainingSecondsLookup = useMemo(
    () => buildRemainingSecondsLookup(words, reader.currentWpm),
    [reader.currentWpm, words]
  );
  const remainingSeconds =
    remainingSecondsLookup[
      Math.min(words.length, Math.max(0, reader.currentIndex + 1))
    ] ?? 0;

  const stateLabel = useMemo(() => {
    if (reader.state === "finished") {
      const readMs = getLiveReadingTimeMs(session);
      const totalSeconds = Math.round(readMs / 1000);
      const wordsRead = Math.max(session.wordsRead, reader.currentIndex + 1);
      const avgWpm =
        readMs > 0 ? Math.round(wordsRead / (readMs / 60_000)) : session.averageWpm;
      return `Done (${wordsRead} words, ${totalSeconds}s, avg ${avgWpm} WPM)`;
    }

    if (
      reader.state === "paused" &&
      reader.currentIndex === 0 &&
      session.startTimeMs === null
    ) {
      return "Press Space to start (Scroll)";
    }

    if (reader.state === "paused") return "Paused";
    if (reader.state === "playing") return "Playing";
    return "Idle";
  }, [reader.currentIndex, reader.state, session]);

  return (
    <Box flexDirection="column" width={width} height={height} alignItems="flex-start">
      {tooSmall ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text>Terminal too small. Resize to at least 40x8.</Text>
        </Box>
      ) : (
        <>
          <Box
            flexGrow={1}
            flexDirection="column"
            justifyContent="center"
            alignItems="flex-start"
          >
            {helpVisible ? (
              <HelpOverlay
                paddingX={textScaleConfig.helpPaddingX}
                paddingY={textScaleConfig.helpPaddingY}
              />
            ) : (
              <Box flexDirection="column" paddingX={1}>
                {lineElements.map((lineEl, idx) => (
                  <Text
                    key={`${visibleStart + idx}`}
                    bold={lineEl.isCurrentLine}
                    dimColor={!lineEl.isCurrentLine}
                  >
                    {lineEl.text}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
          <ProgressBar progress={progress} width={40} />
          <StatusBar
            wpm={reader.currentWpm}
            remainingSeconds={remainingSeconds}
            progress={progress}
            stateLabel={stateLabel}
            sourceLabel={sourceLabel}
            dimColor={textScaleConfig.statusDim}
            separator={textScaleConfig.statusSeparator}
          />
        </>
      )}
    </Box>
  );
}
