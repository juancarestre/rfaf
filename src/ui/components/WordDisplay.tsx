import { Box, Text } from "ink";
import { getORPIndex } from "../orp";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface WordDisplayProps {
  word: string;
  pivotColumn: number;
  showGuide?: boolean;
}

export interface WordDisplayLayout {
  before: string;
  pivot: string;
  after: string;
  leftPadding: string;
}

export function getPivotStyle(noColor: boolean): {
  bold: true;
  underline?: true;
  color?: "red";
} {
  if (noColor) {
    return { bold: true, underline: true };
  }

  return { bold: true, color: "red" };
}

export function getWordDisplayLayout(
  word: string,
  pivotColumn: number
): WordDisplayLayout {
  const safeWord = sanitizeTerminalText(word || "");
  const rawOrp = getORPIndex(safeWord.length);
  const orp = safeWord.length > 0 ? Math.min(rawOrp, safeWord.length - 1) : 0;

  return {
    before: safeWord.slice(0, orp),
    pivot: safeWord[orp] ?? "",
    after: safeWord.slice(orp + 1),
    leftPadding: " ".repeat(Math.max(0, pivotColumn - orp)),
  };
}

export function WordDisplay({
  word,
  pivotColumn,
  showGuide = true,
}: WordDisplayProps) {
  const { before, pivot, after, leftPadding } = getWordDisplayLayout(
    word,
    pivotColumn
  );

  const noColor = Boolean(process.env.NO_COLOR);
  const pivotStyle = getPivotStyle(noColor);

  return (
    <Box flexDirection="column">
      {showGuide ? (
        <Text dimColor>{`${leftPadding}▼`}</Text>
      ) : null}
      <Text>
        {leftPadding}
        <Text bold>{before}</Text>
        <Text {...pivotStyle}>{pivot}</Text>
        <Text bold>{after}</Text>
      </Text>
    </Box>
  );
}
