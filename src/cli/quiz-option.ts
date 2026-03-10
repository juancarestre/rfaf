import { UsageError } from "./errors";

export interface QuizOption {
  enabled: boolean;
}

export function resolveQuizOption(value: unknown): QuizOption {
  if (value === undefined || value === null || value === false) {
    return { enabled: false };
  }

  if (value === true) {
    return { enabled: true };
  }

  throw new UsageError("Invalid --quiz value. Use --quiz without a value.");
}
