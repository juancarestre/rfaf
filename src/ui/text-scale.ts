import type { TextScalePreset } from "../cli/text-scale-option";

export interface TextScaleConfig {
  preset: TextScalePreset;
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
    wordTopPadding: 0,
    wordBottomPadding: 0,
    statusDim: true,
    statusSeparator: " | ",
    helpPaddingX: 1,
    helpPaddingY: 0,
  },
  normal: {
    preset: "normal",
    wordTopPadding: 1,
    wordBottomPadding: 1,
    statusDim: false,
    statusSeparator: "  |  ",
    helpPaddingX: 2,
    helpPaddingY: 1,
  },
  large: {
    preset: "large",
    wordTopPadding: 2,
    wordBottomPadding: 2,
    statusDim: false,
    statusSeparator: "   |   ",
    helpPaddingX: 3,
    helpPaddingY: 1,
  },
};

export { type TextScalePreset };

export function getTextScaleConfig(preset: TextScalePreset): TextScaleConfig {
  return TEXT_SCALE_CONFIG[preset];
}
