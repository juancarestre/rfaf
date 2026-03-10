import { UsageError } from "./errors";

export interface StrategyOption {
  enabled: boolean;
}

const STRATEGY_USAGE_ERROR = "Invalid --strategy value. Use --strategy without a value.";

export function wasStrategyFlagProvided(argv: string[]): boolean {
  return argv.some(
    (arg) =>
      arg === "--strategy" ||
      arg.startsWith("--strategy=") ||
      arg === "--no-strategy" ||
      arg.startsWith("--no-strategy=")
  );
}

export function validateStrategyArgs(rawArgs: string[]): void {
  for (const token of rawArgs) {
    if (token.startsWith("--strategy=")) {
      throw new UsageError(STRATEGY_USAGE_ERROR);
    }

    if (
      token === "--no-strategy" ||
      token.startsWith("--no-strategy=") ||
      token === "--no-no-strategy" ||
      token.startsWith("--no-no-strategy=")
    ) {
      throw new UsageError(STRATEGY_USAGE_ERROR);
    }
  }
}

export function resolveStrategyOption(value: unknown): StrategyOption {
  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (rawValue === undefined || rawValue === null || rawValue === false) {
    return { enabled: false };
  }

  if (rawValue === true) {
    return { enabled: true };
  }

  throw new UsageError(STRATEGY_USAGE_ERROR);
}
