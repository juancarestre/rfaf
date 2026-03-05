import { Text } from "ink";
import { sanitizeTerminalText } from "../sanitize-terminal-text";

interface StatusBarProps {
  wpm: number;
  remainingSeconds: number;
  progress: number;
  stateLabel: string;
  sourceLabel: string;
  dimColor?: boolean;
  separator?: string;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function StatusBar({
  wpm,
  remainingSeconds,
  progress,
  stateLabel,
  sourceLabel,
  dimColor = true,
  separator = " | ",
}: StatusBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const safeStateLabel = sanitizeTerminalText(stateLabel);
  const safeSourceLabel = sanitizeTerminalText(sourceLabel);

  return (
    <Text dimColor={dimColor}>
      {`${wpm} WPM${separator}${formatTime(remainingSeconds)} remaining${separator}${percent}%${separator}${safeStateLabel}${separator}${safeSourceLabel}`}
    </Text>
  );
}
