import { readHistoryRecords } from "../history/history-store";

function formatDuration(seconds: number): string {
  return `${seconds}s`;
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

export function renderHistoryCommand(historyPath: string): string {
  const records = readHistoryRecords(historyPath);

  if (records.length === 0) {
    return "No completed sessions yet.\n";
  }

  const lines = ["Date | Duration | Words | Avg WPM | Mode | Source"];

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) continue;

    lines.push(
      [
        formatDate(record.finishedAtMs),
        formatDuration(record.durationSeconds),
        String(record.wordsRead),
        String(record.averageWpm),
        record.mode,
        record.sourceLabel,
      ].join(" | ")
    );
  }

  return `${lines.join("\n")}\n`;
}
