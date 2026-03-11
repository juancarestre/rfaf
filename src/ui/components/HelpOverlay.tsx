import { Box, Text } from "ink";
import type { ReadingMode } from "../../cli/mode-option";
import { getHelpOverlayGroups } from "../../runtime-controls";

interface HelpOverlayProps {
  paddingX?: number;
  paddingY?: number;
  mode?: ReadingMode;
}

export function HelpOverlay({ paddingX = 1, paddingY = 0, mode = "rsvp" }: HelpOverlayProps) {
  const stepUnit = mode === "scroll" ? "line" : mode === "chunked" ? "chunk" : "word";
  const groups = getHelpOverlayGroups(stepUnit);

  const formatRow = (key: string, action: string): string => `${key.padEnd(10, " ")}${action}`;

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={paddingX} paddingY={paddingY}>
      <Text bold>Runtime Controls</Text>
      <Text dimColor>Press ? to toggle this overlay. Press Esc to close.</Text>
      {groups.map((group) => (
        <Box key={group.heading} flexDirection="column">
          <Text bold>{group.heading}</Text>
          {group.rows.map((row) => (
            <Text key={`${group.heading}-${row.key}-${row.action}`}>{formatRow(row.key, row.action)}</Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
