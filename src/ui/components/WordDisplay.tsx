import { Box, Text } from "ink";
import { emphasizePrefixAlphaNumeric } from "../../processor/bionic";
import { getORPIndex } from "../orp";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface WordDisplayProps {
  word: string;
  pivotColumn: number;
  showGuide?: boolean;
  topPaddingLines?: number;
  bottomPaddingLines?: number;
  renderMode?: "normal" | "expanded";
  orpVisualStyle?: "default" | "subtle";
  bionicPrefixLength?: number;
  keyPhraseMatch?: boolean;
}

const MAX_EXPANDED_RENDER_CHARS = 256;
const WHITESPACE_PATTERN = /\s/u;

function isVisiblePivotCharacter(value: string): boolean {
  return value.length > 0 && !WHITESPACE_PATTERN.test(value);
}

function resolvePivotIndex(displayWord: string): number | null {
  if (displayWord.length === 0) {
    return null;
  }

  const rawOrp = Math.min(getORPIndex(displayWord.length), displayWord.length - 1);
  const rawPivot = displayWord[rawOrp] ?? "";

  if (isVisiblePivotCharacter(rawPivot)) {
    return rawOrp;
  }

  for (let distance = 1; distance < displayWord.length; distance++) {
    const rightIndex = rawOrp + distance;
    if (rightIndex < displayWord.length) {
      const rightCandidate = displayWord[rightIndex] ?? "";
      if (isVisiblePivotCharacter(rightCandidate)) {
        return rightIndex;
      }
    }

    const leftIndex = rawOrp - distance;
    if (leftIndex >= 0) {
      const leftCandidate = displayWord[leftIndex] ?? "";
      if (isVisiblePivotCharacter(leftCandidate)) {
        return leftIndex;
      }
    }
  }

  return null;
}

function spreadUppercase(value: string): string {
  const upper = value.toUpperCase();
  let output = "";

  for (let index = 0; index < upper.length; index++) {
    if (index > 0) output += " ";
    output += upper[index];
  }

  return output;
}

function truncateExpandedRenderWord(value: string): string {
  if (value.length <= MAX_EXPANDED_RENDER_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_EXPANDED_RENDER_CHARS - 3)}...`;
}

export interface WordDisplayLayout {
  before: string;
  pivot: string;
  after: string;
  leftPadding: string;
}

export function getPivotStyle(
  noColor: boolean,
  orpVisualStyle: "default" | "subtle" = "default"
): {
  bold: true;
  underline?: true;
  color?: "red";
} {
  if (orpVisualStyle === "subtle") {
    return { bold: true };
  }

  if (noColor) {
    return { bold: true, underline: true };
  }

  return { bold: true, color: "red" };
}

export function getWordDisplayLayout(
  word: string,
  pivotColumn: number,
  renderMode: "normal" | "expanded" = "normal",
  bionicPrefixLength = 0,
  keyPhraseMatch = false
): WordDisplayLayout {
  const safeWord = sanitizeTerminalText(word || "");
  const baseDisplayWord =
    renderMode === "expanded" ? truncateExpandedRenderWord(safeWord) : safeWord;
  const prefixedWord = emphasizePrefixAlphaNumeric(baseDisplayWord, bionicPrefixLength);
  const displayWord = keyPhraseMatch ? prefixedWord.toUpperCase() : prefixedWord;
  const orp = resolvePivotIndex(displayWord);

  if (renderMode === "expanded") {
    if (orp === null) {
      const before = spreadUppercase(displayWord);
      return {
        before,
        pivot: "",
        after: "",
        leftPadding: " ".repeat(Math.max(0, pivotColumn - before.length)),
      };
    }

    const beforeExpanded = spreadUppercase(displayWord.slice(0, orp));
    const pivotExpanded = (displayWord[orp] ?? "").toUpperCase();
    const afterExpanded = spreadUppercase(displayWord.slice(orp + 1));

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
    before: orp === null ? displayWord : displayWord.slice(0, orp),
    pivot: orp === null ? "" : displayWord[orp] ?? "",
    after: orp === null ? "" : displayWord.slice(orp + 1),
    leftPadding: " ".repeat(Math.max(0, pivotColumn - (orp ?? displayWord.length))),
  };
}

export function WordDisplay({
  word,
  pivotColumn,
  showGuide = true,
  topPaddingLines = 0,
  bottomPaddingLines = 0,
  renderMode = "normal",
  orpVisualStyle = "default",
  bionicPrefixLength = 0,
  keyPhraseMatch = false,
}: WordDisplayProps) {
  const { before, pivot, after, leftPadding } = getWordDisplayLayout(
    word,
    pivotColumn,
    renderMode,
    bionicPrefixLength,
    keyPhraseMatch
  );

  const noColor = Boolean(process.env.NO_COLOR);
  const pivotStyle = getPivotStyle(noColor, orpVisualStyle);

  return (
    <Box flexDirection="column" paddingTop={topPaddingLines} paddingBottom={bottomPaddingLines}>
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
