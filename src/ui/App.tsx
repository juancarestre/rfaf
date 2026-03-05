import type { Word } from "../processor/types";
import { RSVPScreen } from "./screens/RSVPScreen";

interface AppProps {
  words: Word[];
  initialWpm: number;
  sourceLabel: string;
}

export function App({ words, initialWpm, sourceLabel }: AppProps) {
  return <RSVPScreen words={words} initialWpm={initialWpm} sourceLabel={sourceLabel} />;
}
