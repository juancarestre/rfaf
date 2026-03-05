import { Text } from "ink";

interface StatusBarProps {
  wpm: number;
  remainingSeconds: number;
  progress: number;
  stateLabel: string;
  sourceLabel: string;
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
}: StatusBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <Text dimColor>
      {`${wpm} WPM | ${formatTime(remainingSeconds)} remaining | ${percent}% | ${stateLabel} | ${sourceLabel}`}
    </Text>
  );
}
