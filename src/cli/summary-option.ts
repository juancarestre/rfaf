import { UsageError } from "./errors";

export const SUMMARY_PRESETS = ["short", "medium", "long"] as const;

export type SummaryPreset = (typeof SUMMARY_PRESETS)[number];

export const DEFAULT_SUMMARY_PRESET: SummaryPreset = "medium";

export interface SummaryOption {
  enabled: boolean;
  preset: SummaryPreset | null;
}

function isSummaryPreset(value: string): value is SummaryPreset {
  return SUMMARY_PRESETS.includes(value as SummaryPreset);
}

export function wasSummaryFlagProvided(argv: string[]): boolean {
  return argv.some((arg) => arg === "--summary" || arg.startsWith("--summary="));
}

export function resolveSummaryOption(
  value: unknown,
  summaryFlagProvided: boolean
): SummaryOption {
  if (!summaryFlagProvided) {
    return { enabled: false, preset: null };
  }

  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { enabled: true, preset: DEFAULT_SUMMARY_PRESET };
  }

  if (typeof rawValue !== "string") {
    throw new UsageError("Invalid --summary value. Use one of: short, medium, long.");
  }

  const normalized = rawValue.trim().toLowerCase();

  if (!isSummaryPreset(normalized)) {
    throw new UsageError("Invalid --summary value. Use one of: short, medium, long.");
  }

  return {
    enabled: true,
    preset: normalized,
  };
}
