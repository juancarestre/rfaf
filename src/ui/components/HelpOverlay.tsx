import { Box, Text } from "ink";
import type { ReadingMode } from "../../cli/mode-option";

interface HelpOverlayProps {
  paddingX?: number;
  paddingY?: number;
  mode?: ReadingMode;
}

export function HelpOverlay({ paddingX = 1, paddingY = 0, mode = "rsvp" }: HelpOverlayProps) {
  const stepUnit = mode === "scroll" ? "line" : mode === "chunked" ? "chunk" : "word";

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={paddingX} paddingY={paddingY}>
      <Text bold>Keybindings</Text>
      <Text>Space  pause/resume</Text>
      <Text>1-4        switch mode</Text>
      <Text>{`l / Right  step forward (${stepUnit})`}</Text>
      <Text>{`h / Left   step backward (${stepUnit})`}</Text>
      <Text>k / Up     +25 WPM</Text>
      <Text>j / Down   -25 WPM</Text>
      <Text>p          next paragraph</Text>
      <Text>b          previous paragraph</Text>
      <Text>r          restart</Text>
      <Text>q          quit</Text>
      <Text>? / Esc    close this help</Text>
    </Box>
  );
}
