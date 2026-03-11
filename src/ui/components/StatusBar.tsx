import { Text } from "ink";
import type { ReadingMode } from "../../cli/mode-option";
import { getStatusRuntimeHint } from "../../runtime-controls";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface StatusBarProps {
  wpm: number;
  remainingSeconds: number;
  progress: number;
  stateLabel: string;
  sourceLabel: string;
  activeMode?: ReadingMode;
  dimColor?: boolean;
  separator?: string;
  maxWidth?: number;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatMode(mode: ReadingMode): string {
  switch (mode) {
    case "rsvp":
      return "RSVP";
    case "chunked":
      return "Chunked";
    case "bionic":
      return "Bionic";
    case "scroll":
      return "Scroll";
  }
}

function truncateText(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) {
    return value;
  }

  if (maxWidth <= 3) {
    return value.slice(0, maxWidth);
  }

  return `${value.slice(0, maxWidth - 3)}...`;
}

function buildStatusLine(
  segments: string[],
  separator: string,
  maxWidth: number | undefined
): string {
  const fullLine = segments.join(separator);
  if (!maxWidth || fullLine.length <= maxWidth) {
    return fullLine;
  }

  const [wpmSegment = "", remainingSegment = "", percentSegment = "", modeStateSegment = ""] = segments;
  const source = segments[5] ?? "";
  const shortenedModeState = truncateText(
    modeStateSegment,
    Math.max(12, Math.floor(maxWidth * 0.22))
  );
  const coreCandidates = [
    [wpmSegment, remainingSegment, percentSegment, modeStateSegment],
    [wpmSegment, percentSegment, modeStateSegment],
    [wpmSegment, modeStateSegment],
    [wpmSegment, remainingSegment, percentSegment, shortenedModeState],
    [wpmSegment, percentSegment, shortenedModeState],
    [wpmSegment, shortenedModeState],
  ];
  const hintCandidates = [getStatusRuntimeHint("full"), getStatusRuntimeHint("compact"), ""];
  const minSourceWidth = 14;

  let bestLine = truncateText([wpmSegment, modeStateSegment].join(separator), maxWidth);
  let bestScore = -Infinity;
  let bestHintedLine: string | null = null;
  let bestHintedScore = -Infinity;

  for (let coreIndex = 0; coreIndex < coreCandidates.length; coreIndex++) {
    const coreSegments = coreCandidates[coreIndex] ?? [];
    const coreLine = coreSegments.join(separator);
    if (coreLine.length > maxWidth) {
      continue;
    }

    for (let hintIndex = 0; hintIndex < hintCandidates.length; hintIndex++) {
      const hint = hintCandidates[hintIndex] ?? "";
      const withHint = hint ? [...coreSegments, hint] : [...coreSegments];
      const hintLine = withHint.join(separator);
      if (hintLine.length > maxWidth) {
        continue;
      }

      const sourceBudget = maxWidth - hintLine.length - separator.length;
      const candidateLine =
        sourceBudget > 0
          ? [...withHint, truncateText(source, sourceBudget)].join(separator)
          : hintLine;

      const score =
        sourceBudget >= minSourceWidth
          ? 1_000_000 - coreIndex * 1_000 - hintIndex * 100 + sourceBudget
          : sourceBudget * 100 - coreIndex * 10 - hintIndex;
      if (score > bestScore) {
        bestScore = score;
        bestLine = candidateLine;
      }

      if (hint && sourceBudget >= minSourceWidth && score > bestHintedScore) {
        bestHintedScore = score;
        bestHintedLine = candidateLine;
      }
    }
  }

  return bestHintedLine ?? bestLine;
}

export function StatusBar({
  wpm,
  remainingSeconds,
  progress,
  stateLabel,
  sourceLabel,
  activeMode,
  dimColor = true,
  separator = " | ",
  maxWidth,
}: StatusBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const safeStateLabel = sanitizeTerminalText(stateLabel);
  const safeSourceLabel = sanitizeTerminalText(sourceLabel);
  const modePrefix = activeMode ? `[${formatMode(activeMode)}] ` : "";
  const runtimeHints = getStatusRuntimeHint("full");
  const line = buildStatusLine(
    [
      `${wpm} WPM`,
      `${formatTime(remainingSeconds)} remaining`,
      `${percent}%`,
      `${modePrefix}${safeStateLabel}`,
      runtimeHints,
      safeSourceLabel,
    ],
    separator,
    maxWidth
  );

  return <Text dimColor={dimColor}>{line}</Text>;
}
