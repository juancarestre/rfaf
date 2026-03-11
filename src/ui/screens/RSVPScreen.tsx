import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { ReadingMode } from "../../cli/mode-option";
import { getDisplayTime } from "../../processor/pacer";
import type { Word } from "../../processor/types";
import {
  adjustWpm,
  advancePlayback,
  createReader,
  jumpToNextParagraph,
  jumpToPreviousParagraph,
  restartReader,
  stepBackward,
  stepForward,
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
import { WordDisplay } from "../components/WordDisplay";
import { getTextScaleConfig, type TextScalePreset } from "../text-scale";
import { sanitizeTerminalText } from "../sanitize-terminal-text";
import {
  resolveHelpOverlayInput,
  shouldPauseForHelpOverlayOpen,
} from "../help-overlay-input";

interface RSVPScreenProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
  mode: ReadingMode;
  keyPhrasePreview?: string[];
  reader?: Reader;
  session?: Session;
  updateReader?: (transform: (reader: Reader) => Reader) => void;
  onRestart?: () => void;
  helpVisible?: boolean;
  onHelpVisibleChange?: (helpVisible: boolean) => void;
  onQuit?: () => void;
}

export function getReadingLaneLayout(_: TextScalePreset): {
  flexDirection: "column";
  justifyContent: "center";
  alignItems: "flex-start";
} {
  return {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
  };
}

export function getOrpVisualStyle(mode: ReadingMode): "default" | "subtle" {
  return mode === "bionic" ? "subtle" : "default";
}

export function getRsvpHelpOverlayInputResult(
  input: string,
  escape: boolean,
  helpVisible: boolean
) {
  return resolveHelpOverlayInput({ input, escape, helpVisible });
}

function getLiveReadingTimeMs(session: Session): number {
  if (session.lastPlayStartMs === null) return session.totalReadingTimeMs;
  return session.totalReadingTimeMs + (Date.now() - session.lastPlayStartMs);
}

function buildRemainingSecondsLookup(
  words: Word[],
  currentWpm: number
): number[] {
  const lookup = new Array<number>(words.length + 1).fill(0);
  if (words.length === 0) {
    return lookup;
  }

  const hasChunkedWords = words.some(
    (word) => Array.isArray(word.sourceWords) && word.sourceWords.length > 0
  );

  if (!hasChunkedWords) {
    for (let index = words.length; index >= 0; index--) {
      lookup[index] = Math.round(((words.length - index) * 60) / currentWpm);
    }
    return lookup;
  }

  let suffixMs = 0;
  for (let index = words.length - 1; index >= 0; index--) {
    const word = words[index];
    if (!word) continue;
    suffixMs += getDisplayTime(word, currentWpm);
    lookup[index] = Math.round(suffixMs / 1000);
  }

  return lookup;
}

export function getRemainingSeconds(
  words: Word[],
  currentIndex: number,
  currentWpm: number
): number {
  const lookup = buildRemainingSecondsLookup(words, currentWpm);
  const targetIndex = Math.min(words.length, Math.max(0, currentIndex + 1));
  return lookup[targetIndex] ?? 0;
}

export function RSVPScreen({
  words,
  initialWpm,
  sourceLabel,
  textScale,
  mode,
  keyPhrasePreview = [],
  reader,
  session,
  updateReader,
  onRestart,
  helpVisible,
  onHelpVisibleChange,
  onQuit,
}: RSVPScreenProps) {
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
  const readingLaneLayout = getReadingLaneLayout(textScale);
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

  useInput((input, key) => {
    if (input === "q") {
      (onQuit ?? exit)();
      return;
    }

    const helpInputResult = getRsvpHelpOverlayInputResult(
      input,
      key.escape,
      activeHelpVisible
    );
    if (helpInputResult.nextHelpVisible !== null) {
      if (shouldPauseForHelpOverlayOpen(activeReader.state, helpInputResult.nextHelpVisible)) {
        applyReaderUpdate(togglePlayPause);
      }

      setActiveHelpVisible(helpInputResult.nextHelpVisible);
      return;
    }

    if (helpInputResult.suppressInput) {
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

    if (input === "l" || key.rightArrow) {
      applyReaderUpdate(stepForward);
      return;
    }

    if (input === "h" || key.leftArrow) {
      applyReaderUpdate(stepBackward);
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

  const currentWordEntry = words[activeReader.currentIndex];
  const currentWord = currentWordEntry?.text ?? "";
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
      if (mode === "chunked") {
        return "Press Space to start (Chunked)";
      }

      if (mode === "bionic") {
        return "Press Space to start (Bionic)";
      }

      return "Press Space to start (RSVP)";
    }

    if (activeReader.state === "paused") return "Paused";
    if (activeReader.state === "playing") return "Playing";
    return "Idle";
  }, [activeReader.currentIndex, activeReader.state, activeSession, mode]);

  const showKeyPhrasePreview =
    keyPhrasePreview.length > 0 &&
    activeReader.state === "paused" &&
    activeReader.currentIndex === 0 &&
    activeSession.startTimeMs === null &&
    !activeHelpVisible;
  const safeKeyPhrasePreview = useMemo(
    () => keyPhrasePreview.map((phrase) => sanitizeTerminalText(phrase)),
    [keyPhrasePreview]
  );

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
            flexDirection={readingLaneLayout.flexDirection}
            justifyContent={readingLaneLayout.justifyContent}
            alignItems={readingLaneLayout.alignItems}
          >
            {activeHelpVisible ? (
              <HelpOverlay
                paddingX={textScaleConfig.helpPaddingX}
                paddingY={textScaleConfig.helpPaddingY}
                mode={mode}
              />
            ) : (
              <>
                {showKeyPhrasePreview ? (
                  <Box flexDirection="column" marginBottom={1}>
                    <Text bold>Key phrases:</Text>
                    {safeKeyPhrasePreview.map((phrase, index) => (
                      <Text key={`${index}-${phrase}`}>{`- ${phrase}`}</Text>
                    ))}
                  </Box>
                ) : null}
                <WordDisplay
                  word={currentWord}
                  pivotColumn={Math.max(8, Math.floor(width / 2))}
                  topPaddingLines={textScaleConfig.wordTopPadding}
                  bottomPaddingLines={textScaleConfig.wordBottomPadding}
                  renderMode={textScaleConfig.wordRenderMode}
                  orpVisualStyle={getOrpVisualStyle(mode)}
                  bionicPrefixLength={
                    mode === "bionic" ? currentWordEntry?.bionicPrefixLength ?? 0 : 0
                  }
                  keyPhraseMatch={currentWordEntry?.keyPhraseMatch ?? false}
                />
              </>
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
