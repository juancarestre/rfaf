import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
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
import { WordDisplay } from "../components/WordDisplay";
import { getTextScaleConfig, type TextScalePreset } from "../text-scale";

interface RSVPScreenProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
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

function getLiveReadingTimeMs(session: Session): number {
  if (session.lastPlayStartMs === null) return session.totalReadingTimeMs;
  return session.totalReadingTimeMs + (Date.now() - session.lastPlayStartMs);
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

export function RSVPScreen({
  words,
  initialWpm,
  sourceLabel,
  textScale,
}: RSVPScreenProps) {
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
  const readingLaneLayout = getReadingLaneLayout(textScale);

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

    if (input === "l" || key.rightArrow) {
      updateReader(stepForward);
      return;
    }

    if (input === "h" || key.leftArrow) {
      updateReader(stepBackward);
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

  const currentWord = words[reader.currentIndex]?.text ?? "";
  const progress = useMemo(() => {
    if (words.length <= 1) return 1;
    return reader.currentIndex / (words.length - 1);
  }, [reader.currentIndex, words.length]);

  const remainingWords = Math.max(0, words.length - reader.currentIndex - 1);
  const remainingSeconds = Math.round((remainingWords * 60) / reader.currentWpm);

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
      return "Press Space to start";
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
            flexDirection={readingLaneLayout.flexDirection}
            justifyContent={readingLaneLayout.justifyContent}
            alignItems={readingLaneLayout.alignItems}
          >
            {helpVisible ? (
              <HelpOverlay
                paddingX={textScaleConfig.helpPaddingX}
                paddingY={textScaleConfig.helpPaddingY}
              />
            ) : (
              <WordDisplay
                word={currentWord}
                pivotColumn={Math.max(8, Math.floor(width / 2))}
                topPaddingLines={textScaleConfig.wordTopPadding}
                bottomPaddingLines={textScaleConfig.wordBottomPadding}
                renderMode={textScaleConfig.wordRenderMode}
              />
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
