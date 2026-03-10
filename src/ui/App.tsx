import { useApp } from "ink";
import { useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { createReader, restartReader, type Reader } from "../engine/reader";
import { applyReaderAndSession } from "../engine/reader-session-sync";
import { createSession } from "../engine/session";
import type { Word } from "../processor/types";
import type { ReadingMode } from "../cli/mode-option";
import { RSVPScreen } from "./screens/RSVPScreen";
import { GuidedScrollScreen } from "./screens/GuidedScrollScreen";
import type { TextScalePreset } from "./text-scale";
import {
  applyAppModeInput,
  createAppRuntimeState,
  type AppRuntimeState,
} from "./runtime-mode-state";
import { persistCompletedSessionTransition } from "../history/history-runtime";

interface AppProps {
  sourceWords: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
  initialMode: ReadingMode;
  historyPath?: string;
  keyPhrasePreview?: string[];
}

export function App({
  sourceWords,
  initialWpm,
  sourceLabel,
  textScale,
  initialMode,
  historyPath,
  keyPhrasePreview = [],
}: AppProps) {
  const { exit } = useApp();
  const [runtime, setRuntime] = useState<AppRuntimeState>(() =>
    createAppRuntimeState(sourceWords, initialMode, initialWpm)
  );
  const previousRuntimeRef = useRef<AppRuntimeState | null>(null);

  const updateReader = (transform: (reader: Reader) => Reader) => {
    setRuntime((currentRuntime) => {
      const nextReader = transform(currentRuntime.reader);
      const nextSession = applyReaderAndSession(
        currentRuntime.reader,
        currentRuntime.session,
        nextReader
      );

      return {
        ...currentRuntime,
        reader: nextReader,
        session: nextSession,
      };
    });
  };

  const restart = () => {
    setRuntime((currentRuntime) => {
      const restartedReader = restartReader(currentRuntime.reader);

      return {
        ...currentRuntime,
        reader: restartedReader,
        session: createSession(restartedReader.currentWpm),
      };
    });
  };

  const setHelpVisible = (helpVisible: boolean) => {
    setRuntime((currentRuntime) => ({
      ...currentRuntime,
      helpVisible,
    }));
  };

  useInput((input) => {
    setRuntime((currentRuntime) => applyAppModeInput(currentRuntime, sourceWords, input));
  });

  useEffect(() => {
    const previousRuntime = previousRuntimeRef.current;

    if (historyPath && previousRuntime) {
      persistCompletedSessionTransition({
        historyPath,
        currentReader: previousRuntime.reader,
        nextReader: runtime.reader,
        nextSession: runtime.session,
        mode: runtime.activeMode,
        sourceLabel,
      });
    }

    previousRuntimeRef.current = runtime;
  }, [historyPath, runtime, sourceLabel]);

  if (runtime.activeMode === "scroll") {
    return (
      <GuidedScrollScreen
        words={runtime.reader.words}
        initialWpm={initialWpm}
        sourceLabel={sourceLabel}
        textScale={textScale}
        mode={runtime.activeMode}
        keyPhrasePreview={keyPhrasePreview}
        reader={runtime.reader}
        session={runtime.session}
        updateReader={updateReader}
        onRestart={restart}
        helpVisible={runtime.helpVisible}
        onHelpVisibleChange={setHelpVisible}
        onQuit={exit}
      />
    );
  }

  return (
    <RSVPScreen
      words={runtime.reader.words}
      initialWpm={initialWpm}
      sourceLabel={sourceLabel}
      textScale={textScale}
      mode={runtime.activeMode}
      keyPhrasePreview={keyPhrasePreview}
      reader={runtime.reader}
      session={runtime.session}
      updateReader={updateReader}
      onRestart={restart}
      helpVisible={runtime.helpVisible}
      onHelpVisibleChange={setHelpVisible}
      onQuit={exit}
    />
  );
}
