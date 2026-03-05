export const TEXT_SCALE_PRESETS = ["small", "normal", "large"] as const;

export type TextScalePreset = (typeof TEXT_SCALE_PRESETS)[number];

export const DEFAULT_TEXT_SCALE: TextScalePreset = "normal";

function isTextScalePreset(value: string): value is TextScalePreset {
  return TEXT_SCALE_PRESETS.includes(value as TextScalePreset);
}

export function resolveTextScale(value: unknown): TextScalePreset {
  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_TEXT_SCALE;
  }

  if (typeof rawValue !== "string") {
    throw new Error("Invalid --text-scale value. Use one of: small, normal, large.");
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!isTextScalePreset(normalized)) {
    throw new Error("Invalid --text-scale value. Use one of: small, normal, large.");
  }

  return normalized;
}
