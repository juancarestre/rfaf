import { UsageError } from "./errors";

export const KEY_PHRASES_OUTPUT_MODES = ["preview", "list"] as const;

export type KeyPhrasesOutputMode = (typeof KEY_PHRASES_OUTPUT_MODES)[number];

export interface KeyPhrasesOption {
  enabled: boolean;
  mode: KeyPhrasesOutputMode | null;
  maxPhrases: number | null;
}

export const DEFAULT_KEY_PHRASES_MODE: KeyPhrasesOutputMode = "preview";
export const DEFAULT_KEY_PHRASES_MAX_PHRASES = 8;

function isOutputMode(value: string): value is KeyPhrasesOutputMode {
  return KEY_PHRASES_OUTPUT_MODES.includes(value as KeyPhrasesOutputMode);
}

export function wasKeyPhrasesFlagProvided(argv: string[]): boolean {
  return argv.some((arg) => arg === "--key-phrases" || arg.startsWith("--key-phrases="));
}

export function resolveKeyPhrasesOption(
  value: unknown,
  keyPhrasesFlagProvided: boolean
): KeyPhrasesOption {
  if (!keyPhrasesFlagProvided) {
    return { enabled: false, mode: null, maxPhrases: null };
  }

  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return {
      enabled: true,
      mode: DEFAULT_KEY_PHRASES_MODE,
      maxPhrases: DEFAULT_KEY_PHRASES_MAX_PHRASES,
    };
  }

  if (typeof rawValue !== "string") {
    throw new UsageError("Invalid --key-phrases value. Use one of: preview, list.");
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!isOutputMode(normalized)) {
    throw new UsageError("Invalid --key-phrases value. Use one of: preview, list.");
  }

  return {
    enabled: true,
    mode: normalized,
    maxPhrases: DEFAULT_KEY_PHRASES_MAX_PHRASES,
  };
}
