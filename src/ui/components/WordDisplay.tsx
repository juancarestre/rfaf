import { Box, Text } from "ink";
import { getORPIndex } from "../orp";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface WordDisplayProps {
  word: string;
  pivotColumn: number;
  showGuide?: boolean;
  topPaddingLines?: number;
  bottomPaddingLines?: number;
  renderMode?: "normal" | "expanded";
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
  pivotColumn: number,
  renderMode: "normal" | "expanded" = "normal"
): WordDisplayLayout {
  const safeWord = sanitizeTerminalText(word || "");
  const rawOrp = getORPIndex(safeWord.length);
  const orp = safeWord.length > 0 ? Math.min(rawOrp, safeWord.length - 1) : 0;

  if (renderMode === "expanded") {
    const spread = (value: string) => value.split("").join(" ");

    const beforeExpanded = spread(safeWord.slice(0, orp).toUpperCase());
    const pivotExpanded = (safeWord[orp] ?? "").toUpperCase();
    const afterExpanded = spread(safeWord.slice(orp + 1).toUpperCase());

    const before = beforeExpanded ? `${beforeExpanded} ` : "";
    const after = afterExpanded ? ` ${afterExpanded}` : "";

    return {
      before,
      pivot: pivotExpanded,
      after,
      leftPadding: " ".repeat(Math.max(0, pivotColumn - before.length)),
    };
  }

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
  topPaddingLines = 0,
  bottomPaddingLines = 0,
  renderMode = "normal",
}: WordDisplayProps) {
  const { before, pivot, after, leftPadding } = getWordDisplayLayout(
    word,
    pivotColumn,
    renderMode
  );

  const noColor = Boolean(process.env.NO_COLOR);
  const pivotStyle = getPivotStyle(noColor);

  return (
    <Box flexDirection="column">
      {Array.from({ length: topPaddingLines }, (_, index) => (
        <Text key={`top-pad-${index}`}> </Text>
      ))}
      {showGuide ? (
        <Text dimColor>{`${leftPadding}▼`}</Text>
      ) : null}
      <Text>
        {leftPadding}
        <Text bold>{before}</Text>
        <Text {...pivotStyle}>{pivot}</Text>
        <Text bold>{after}</Text>
      </Text>
      {Array.from({ length: bottomPaddingLines }, (_, index) => (
        <Text key={`bottom-pad-${index}`}> </Text>
      ))}
    </Box>
  );
}
