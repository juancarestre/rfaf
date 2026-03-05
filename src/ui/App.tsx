import type { Word } from "../processor/types";
import { RSVPScreen } from "./screens/RSVPScreen";
import type { TextScalePreset } from "./text-scale";

interface AppProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
  textScale: TextScalePreset;
}

export function App({ words, initialWpm, sourceLabel, textScale }: AppProps) {
  return (
    <RSVPScreen
      words={words}
      initialWpm={initialWpm}
      sourceLabel={sourceLabel}
      textScale={textScale}
    />
  );
}
