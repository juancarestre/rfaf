import { Box, Text } from "ink";

interface HelpOverlayProps {
  paddingX?: number;
  paddingY?: number;
}

export function HelpOverlay({ paddingX = 1, paddingY = 0 }: HelpOverlayProps) {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={paddingX} paddingY={paddingY}>
      <Text bold>Keybindings</Text>
      <Text>Space  pause/resume</Text>
      <Text>l / Right  step forward</Text>
      <Text>h / Left   step backward</Text>
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
