import { Text } from "ink";

interface ProgressBarProps {
  progress: number;
  width?: number;
}

export function ProgressBar({ progress, width = 30 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const percent = Math.round(clamped * 100);

  return <Text>{`${"█".repeat(filled)}${"░".repeat(empty)} ${percent}%`}</Text>;
}
