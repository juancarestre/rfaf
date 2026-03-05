import type { Word } from "../processor/types";
import type { ReadingMode } from "../cli/mode-option";
import { RSVPScreen } from "./screens/RSVPScreen";
import type { TextScalePreset } from "./text-scale";

interface AppProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
  mode: ReadingMode;
}

export function App({ words, initialWpm, sourceLabel, textScale, mode }: AppProps) {
  return (
    <RSVPScreen
      words={words}
      initialWpm={initialWpm}
      sourceLabel={sourceLabel}
      textScale={textScale}
      mode={mode}
    />
  );
}
