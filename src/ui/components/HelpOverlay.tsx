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
      <Text bold>Runtime Controls</Text>
      <Text dimColor>Press ? to toggle this overlay. Press Esc to close.</Text>
      <Text bold>Playback</Text>
      <Text>Space      play/pause</Text>
      <Text bold>Mode</Text>
      <Text>1-4        switch mode</Text>
      <Text bold>Navigation</Text>
      <Text>{`l / Right  step forward (${stepUnit})`}</Text>
      <Text>{`h / Left   step backward (${stepUnit})`}</Text>
      <Text>p          next paragraph</Text>
      <Text>b          previous paragraph</Text>
      <Text bold>Speed</Text>
      <Text>k / Up     +25 WPM</Text>
      <Text>j / Down   -25 WPM</Text>
      <Text bold>Session</Text>
      <Text>r          restart</Text>
      <Text>q          quit</Text>
      <Text>?          toggle help overlay</Text>
      <Text>Esc        close help overlay</Text>
    </Box>
  );
}
