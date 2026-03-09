import { UsageError } from "./errors";

export interface TranslateOption {
  enabled: boolean;
  target: string | null;
}

export function wasTranslateFlagProvided(argv: string[]): boolean {
  return argv.some((arg) => arg === "--translate-to" || arg.startsWith("--translate-to="));
}

export function resolveTranslateOption(
  value: unknown,
  translateFlagProvided: boolean
): TranslateOption {
  if (!translateFlagProvided) {
    return { enabled: false, target: null };
  }

  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw new UsageError("Invalid --translate-to value. Provide a target language.");
  }

  const target = rawValue.trim().toLowerCase();
  if (target.length > 64) {
    throw new UsageError("Invalid --translate-to value. Provide a target language.");
  }

  return {
    enabled: true,
    target,
  };
}
