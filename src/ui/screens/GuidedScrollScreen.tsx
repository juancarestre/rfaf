import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { ReadingMode } from "../../cli/mode-option";
import { getDisplayTime } from "../../processor/pacer";
import type { Word } from "../../processor/types";
import {
  computeLineMap,
  getFirstWordIndexForLine,
  getLastWordIndexForLine,
  getLineForWordIndex,
  getNextLineStartIndex,
  getPreviousLineStartIndex,
} from "../../processor/line-computation";
import {
  adjustWpm,
  advancePlayback,
  createReader,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
  restartReader,
  togglePlayPause,
  type Reader,
} from "../../engine/reader";
import { applyReaderAndSession } from "../../engine/reader-session-sync";
import {
  createSession,
  type Session,
} from "../../engine/session";
import { HelpOverlay } from "../components/HelpOverlay";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBar } from "../components/StatusBar";
import { getTextScaleConfig, type TextScalePreset } from "../text-scale";
import { sanitizeTerminalText } from "../../terminal/sanitize-terminal-text";

interface GuidedScrollScreenProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
  mode: ReadingMode;
  reader?: Reader;
  session?: Session;
  updateReader?: (transform: (reader: Reader) => Reader) => void;
  onRestart?: () => void;
  helpVisible?: boolean;
  onHelpVisibleChange?: (helpVisible: boolean) => void;
  onQuit?: () => void;
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

/**
 * Build text for a single line from its constituent words.
 */
function buildLineText(words: string[], startIdx: number, endIdx: number): string {
  const parts: string[] = [];
  for (let i = startIdx; i <= endIdx && i < words.length; i++) {
    parts.push(words[i]!);
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

  return { ...paused, currentIndex: getNextLineStartIndex(lineMap, paused.currentIndex) };
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

  return { ...paused, currentIndex: getPreviousLineStartIndex(lineMap, paused.currentIndex) };
}

export function GuidedScrollScreen({
  words,
  initialWpm,
  sourceLabel,
  textScale,
  mode,
  reader,
  session,
  updateReader,
  onRestart,
  helpVisible,
  onHelpVisibleChange,
  onQuit,
}: GuidedScrollScreenProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState(() => ({
    width: stdout.columns ?? 80,
    height: stdout.rows ?? 24,
  }));
  const [localReader, setLocalReader] = useState(() => createReader(words, initialWpm));
  const [localSession, setLocalSession] = useState(() => createSession(initialWpm));
  const [localHelpVisible, setLocalHelpVisible] = useState(false);
  const textScaleConfig = getTextScaleConfig(textScale);
  const activeReader = reader ?? localReader;
  const activeSession = session ?? localSession;
  const activeHelpVisible = helpVisible ?? localHelpVisible;

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

  // Account for paddingX={1} on the text container (1 char each side = 2 total)
  const textPaddingX = 1;
  const contentWidth = Math.max(1, width - textPaddingX * 2);
  const sanitizedWords = useMemo(
    () => words.map((word) => sanitizeTerminalText(word.text)),
    [words]
  );

  // Precomputed line map -- recomputed on resize or word change
  const lineMap = useMemo(
    () => computeLineMap(words, contentWidth),
    [words, contentWidth]
  );
  const lineTexts = useMemo(() => {
    const nextLineTexts: string[] = [];

    for (let line = 0; line < lineMap.totalLines; line++) {
      nextLineTexts.push(
        buildLineText(
          sanitizedWords,
          getFirstWordIndexForLine(lineMap, line),
          getLastWordIndexForLine(lineMap, line)
        )
      );
    }

    return nextLineTexts;
  }, [lineMap, sanitizedWords]);

  const applyReaderUpdate = (transform: (reader: Reader) => Reader) => {
    if (updateReader) {
      updateReader(transform);
      return;
    }

    setLocalReader((currentReader) => {
      const nextReader = transform(currentReader);
      setLocalSession((currentSession) =>
        applyReaderAndSession(currentReader, currentSession, nextReader)
      );
      return nextReader;
    });
  };

  const setActiveHelpVisible = (visible: boolean) => {
    if (onHelpVisibleChange) {
      onHelpVisibleChange(visible);
      return;
    }

    setLocalHelpVisible(visible);
  };

  useEffect(() => {
    if (tooSmall && activeReader.state === "playing") {
      applyReaderUpdate(togglePlayPause);
    }
  }, [activeReader.state, tooSmall]);

  // Auto-advance: schedule next word tick using per-word display time
  useEffect(() => {
    if (activeReader.state !== "playing" || activeHelpVisible || tooSmall) return;

    const word = words[activeReader.currentIndex];
    if (!word) return;

    const delay = Math.max(1, Math.round(getDisplayTime(word, activeReader.currentWpm)));
    const timer = setTimeout(() => {
      applyReaderUpdate(advancePlayback);
    }, delay);

    return () => clearTimeout(timer);
  }, [
    activeHelpVisible,
    activeReader.currentIndex,
    activeReader.currentWpm,
    activeReader.state,
    tooSmall,
    words,
  ]);

  // Keybindings
  useInput((input, key) => {
    if (input === "q") {
      (onQuit ?? exit)();
      return;
    }

    if (activeHelpVisible) {
      if (input === "?" || key.escape) {
        setActiveHelpVisible(false);
      }
      return;
    }

    if (input === "?") {
      if (activeReader.state === "playing") {
        applyReaderUpdate(togglePlayPause);
      }
      setActiveHelpVisible(true);
      return;
    }

    if (input === " ") {
      applyReaderUpdate(togglePlayPause);
      return;
    }

    if (input === "r") {
      if (onRestart) {
        onRestart();
      } else {
        setLocalReader((currentReader) => {
          const restarted = restartReader(currentReader);
          setLocalSession(createSession(restarted.currentWpm));
          return restarted;
        });
      }
      return;
    }

    // Step by LINE (scroll unit), not by word
    if (input === "l" || key.rightArrow) {
      applyReaderUpdate((r) => stepForwardByLine(r, lineMap));
      return;
    }

    if (input === "h" || key.leftArrow) {
      applyReaderUpdate((r) => stepBackwardByLine(r, lineMap));
      return;
    }

    if (input === "k" || key.upArrow) {
      applyReaderUpdate((currentReader) => adjustWpm(currentReader, 25));
      return;
    }

    if (input === "j" || key.downArrow) {
      applyReaderUpdate((currentReader) => adjustWpm(currentReader, -25));
      return;
    }

    if (input === "p") {
      applyReaderUpdate(jumpToNextParagraph);
      return;
    }

    if (input === "b") {
      applyReaderUpdate(jumpToPreviousParagraph);
    }
  });

  // Derive current line from currentIndex
  const currentLine = getLineForWordIndex(lineMap, activeReader.currentIndex);

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
    lineElements.push({
      text: lineTexts[line] ?? "",
      isCurrentLine: line === currentLine,
    });
  }

  const progress = useMemo(() => {
    if (words.length <= 1) return 1;
    return activeReader.currentIndex / (words.length - 1);
  }, [activeReader.currentIndex, words.length]);

  const remainingSecondsLookup = useMemo(
    () => buildRemainingSecondsLookup(words, activeReader.currentWpm),
    [activeReader.currentWpm, words]
  );
  const remainingSeconds =
    remainingSecondsLookup[
      Math.min(words.length, Math.max(0, activeReader.currentIndex + 1))
    ] ?? 0;

  const stateLabel = useMemo(() => {
    if (activeReader.state === "finished") {
      const readMs = getLiveReadingTimeMs(activeSession);
      const totalSeconds = Math.round(readMs / 1000);
      const wordsRead = Math.max(activeSession.wordsRead, activeReader.currentIndex + 1);
      const avgWpm =
        readMs > 0 ? Math.round(wordsRead / (readMs / 60_000)) : activeSession.averageWpm;
      return `Done (${wordsRead} words, ${totalSeconds}s, avg ${avgWpm} WPM)`;
    }

    if (
      activeReader.state === "paused" &&
      activeReader.currentIndex === 0 &&
      activeSession.startTimeMs === null
    ) {
      return "Press Space to start (Scroll)";
    }

    if (activeReader.state === "paused") return "Paused";
    if (activeReader.state === "playing") return "Playing";
    return "Idle";
  }, [activeReader.currentIndex, activeReader.state, activeSession]);

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
            {activeHelpVisible ? (
              <HelpOverlay
                paddingX={textScaleConfig.helpPaddingX}
                paddingY={textScaleConfig.helpPaddingY}
                mode={mode}
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
            wpm={activeReader.currentWpm}
            remainingSeconds={remainingSeconds}
            progress={progress}
            stateLabel={stateLabel}
            sourceLabel={sourceLabel}
            activeMode={mode}
            dimColor={textScaleConfig.statusDim}
            separator={textScaleConfig.statusSeparator}
          />
        </>
      )}
    </Box>
  );
}
