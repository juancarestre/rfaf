import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import { recommendStrategy, type StrategyRecommendation } from "../llm/strategy";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { StrategyRuntimeError, UserCancelledError } from "./errors";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import type { ReadingMode } from "./mode-option";
import type { StrategyOption } from "./strategy-option";

export const MAX_STRATEGY_INPUT_CHARS = 4_000;
export const MAX_STRATEGY_TIMEOUT_MS = 5_000;
export const MAX_STRATEGY_RETRIES = 1;
const STRATEGY_TRUNCATION_MARKER = "\n\n[... strategy input truncated ...]\n\n";

export interface StrategyFlowInput {
  documentContent: string;
  strategyOption: StrategyOption;
  selectedMode: ReadingMode;
  explicitModeProvided: boolean;
  signal?: AbortSignal;
  captureSigInt?: boolean;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  recommend?: (input: {
    provider: LLMConfig["provider"];
    model: string;
    apiKey: string;
    input: string;
    timeoutMs: number;
    maxRetries: number;
    signal?: AbortSignal;
  }) => Promise<StrategyRecommendation>;
  createLoading?: (message: string) => LoadingIndicator;
}

export interface StrategyFlowOutput {
  recommendedMode: ReadingMode | null;
  rationale: string | null;
  warning: string | null;
}

export function resolveModeAfterStrategy(input: {
  selectedMode: ReadingMode;
  explicitModeProvided: boolean;
  recommendedMode: ReadingMode | null;
}): ReadingMode {
  if (input.explicitModeProvided || !input.recommendedMode) {
    return input.selectedMode;
  }

  return input.recommendedMode;
}

function boundStrategyInput(text: string): string {
  if (text.length <= MAX_STRATEGY_INPUT_CHARS) {
    return text;
  }

  const available = Math.max(0, MAX_STRATEGY_INPUT_CHARS - STRATEGY_TRUNCATION_MARKER.length);
  const headChars = Math.ceil(available * 0.6);
  const tailChars = available - headChars;
  return `${text.slice(0, headChars)}${STRATEGY_TRUNCATION_MARKER}${text.slice(-tailChars)}`;
}

function resolveStrategyBudget(llmConfig: LLMConfig): { timeoutMs: number; maxRetries: number } {
  return {
    timeoutMs: Math.min(llmConfig.timeoutMs, MAX_STRATEGY_TIMEOUT_MS),
    maxRetries: Math.min(llmConfig.maxRetries, MAX_STRATEGY_RETRIES),
  };
}

export async function strategyBeforeRsvp(input: StrategyFlowInput): Promise<StrategyFlowOutput> {
  if (!input.strategyOption.enabled) {
    return {
      recommendedMode: null,
      rationale: null,
      warning: null,
    };
  }

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const runStrategy = input.recommend ?? recommendStrategy;

  let llmConfig: LLMConfig;
  try {
    llmConfig = resolveConfig(env);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      recommendedMode: null,
      rationale: null,
      warning: `Strategy unavailable [config]: ${sanitizeTerminalText(message)}`,
    };
  }

  const boundedInput = boundStrategyInput(input.documentContent);
  const strategyBudget = resolveStrategyBudget(llmConfig);

  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(
    `analyzing strategy with ${llmConfig.provider}/${llmConfig.model}`
  );

  const abortController = new AbortController();
  const captureSigInt = input.captureSigInt ?? true;
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };
  const onParentAbort = () => {
    abortController.abort(input.signal?.reason ?? new Error("aborted"));
  };

  if (input.signal) {
    if (input.signal.aborted) {
      onParentAbort();
    } else {
      input.signal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  if (captureSigInt) {
    process.once("SIGINT", onSigInt);
  }
  loading.start();

  try {
    const recommendation = await runStrategy({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      input: boundedInput,
      timeoutMs: strategyBudget.timeoutMs,
      maxRetries: strategyBudget.maxRetries,
      signal: abortController.signal,
    });

    loading.stop();

    const safeRationale = sanitizeTerminalText(recommendation.rationale);
    const message = input.explicitModeProvided
      ? `strategy would pick ${recommendation.mode}: ${safeRationale}; keeping --mode=${input.selectedMode}`
      : `strategy recommends ${recommendation.mode}: ${safeRationale}; starting mode=${recommendation.mode}`;

    loading.succeed(message);

    return {
      recommendedMode: recommendation.mode,
      rationale: recommendation.rationale,
      warning: null,
    };
  } catch (error: unknown) {
    loading.stop();

    if (abortController.signal.aborted) {
      const reason = abortController.signal.reason;
      const reasonMessage = reason instanceof Error ? reason.message : String(reason);
      if (reasonMessage.toLowerCase().includes("sigint")) {
        throw new UserCancelledError("Cancelled by user (SIGINT).");
      }
    }

    if (error instanceof StrategyRuntimeError) {
      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      return {
        recommendedMode: null,
        rationale: null,
        warning: `${sanitizeTerminalText(error.message)} (provider=${provider}, model=${model})`,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      recommendedMode: null,
      rationale: null,
      warning: `Strategy unavailable [runtime]: ${sanitizeTerminalText(message)}`,
    };
  } finally {
    if (captureSigInt) {
      process.removeListener("SIGINT", onSigInt);
    }
    if (input.signal) {
      input.signal.removeEventListener("abort", onParentAbort);
    }
  }
}
