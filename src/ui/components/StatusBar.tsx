import { Text } from "ink";
import type { ReadingMode } from "../../cli/mode-option";
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

export function StatusBar({
  wpm,
  remainingSeconds,
  progress,
  stateLabel,
  sourceLabel,
  activeMode,
  dimColor = true,
  separator = " | ",
}: StatusBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const safeStateLabel = sanitizeTerminalText(stateLabel);
  const safeSourceLabel = sanitizeTerminalText(sourceLabel);
  const modePrefix = activeMode ? `[${formatMode(activeMode)}] ` : "";
  const runtimeHints = "? help, ←/→ nav, ↑/↓ speed, r restart, q quit";

  return (
    <Text dimColor={dimColor}>
      {`${wpm} WPM${separator}${formatTime(remainingSeconds)} remaining${separator}${percent}%${separator}${modePrefix}${safeStateLabel}${separator}${runtimeHints}${separator}${safeSourceLabel}`}
    </Text>
  );
}
