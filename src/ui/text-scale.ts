import type { TextScalePreset } from "../cli/text-scale-option";

export interface TextScaleConfig {
  preset: TextScalePreset;
  wordRenderMode: "normal" | "expanded";
  wordTopPadding: number;
  wordBottomPadding: number;
  statusDim: boolean;
  statusSeparator: string;
  helpPaddingX: number;
  helpPaddingY: number;
}

const TEXT_SCALE_CONFIG: Record<TextScalePreset, TextScaleConfig> = {
  small: {
    preset: "small",
    wordRenderMode: "normal",
    wordTopPadding: 0,
    wordBottomPadding: 0,
    statusDim: true,
    statusSeparator: " | ",
    helpPaddingX: 1,
    helpPaddingY: 0,
  },
  normal: {
    preset: "normal",
    wordRenderMode: "normal",
    wordTopPadding: 1,
    wordBottomPadding: 1,
    statusDim: false,
    statusSeparator: "  |  ",
    helpPaddingX: 2,
    helpPaddingY: 1,
  },
  large: {
    preset: "large",
    wordRenderMode: "expanded",
    wordTopPadding: 4,
    wordBottomPadding: 4,
    statusDim: false,
    statusSeparator: "    |    ",
    helpPaddingX: 4,
    helpPaddingY: 2,
  },
};

export { type TextScalePreset };

export function getTextScaleConfig(preset: TextScalePreset): TextScaleConfig {
  return TEXT_SCALE_CONFIG[preset];
}
