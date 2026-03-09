import { UsageError } from "./errors";

export interface NoBsOption {
  enabled: boolean;
}

export function resolveNoBsOption(value: unknown): NoBsOption {
  if (value === undefined || value === null || value === false) {
    return { enabled: false };
  }

  if (value === true) {
    return { enabled: true };
  }

  throw new UsageError("Invalid --no-bs value. Use --no-bs without a value.");
}
