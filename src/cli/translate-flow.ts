import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import {
  LanguageNormalizationError,
  normalizeTargetLanguage,
  type LanguageNormalizerInput,
} from "../llm/language-normalizer";
import {
  DEFAULT_TRANSLATE_CONCURRENCY,
  splitIntoTranslationChunks,
  translateContentInChunks,
} from "../llm/translate-chunking";
import { translateText, type TranslateInput } from "../llm/translate";
import { createTimeoutDeadline, resolveAdaptiveTimeoutMs } from "../llm/timeout-policy";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import { TranslateRuntimeError, UsageError } from "./errors";
import type { TranslateOption } from "./translate-option";
import {
  resolveTimeoutRecoveryOutcome,
  type TimeoutRecoveryOutcome,
} from "./timeout-recovery";

export interface TranslateFlowInput {
  documentContent: string;
  sourceLabel: string;
  translateOption: TranslateOption;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  normalizeTarget?: (input: LanguageNormalizerInput) => Promise<string>;
  translate?: (input: TranslateInput) => Promise<string>;
  createLoading?: (message: string) => LoadingIndicator;
  resolveTimeoutOutcome?: (input: {
    transformLabel: string;
    isInteractive: boolean;
    allowNonInteractiveContinue?: boolean;
  }) => Promise<TimeoutRecoveryOutcome>;
  isInteractive?: boolean;
  writeWarning?: (line: string) => void;
}

export interface TranslateFlowOutput {
  readingContent: string;
  sourceLabel: string;
}

export async function translateBeforeRsvp(
  input: TranslateFlowInput
): Promise<TranslateFlowOutput> {
  if (!input.translateOption.enabled || !input.translateOption.target) {
    return {
      readingContent: input.documentContent,
      sourceLabel: input.sourceLabel,
    };
  }

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const normalizeTarget = input.normalizeTarget ?? normalizeTargetLanguage;
  const translate = input.translate ?? translateText;
  const resolveTimeoutOutcome = input.resolveTimeoutOutcome ?? resolveTimeoutRecoveryOutcome;
  const isInteractive = input.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const allowNonInteractiveContinue = env.RFAF_TIMEOUT_CONTINUE === "1";
  const writeWarning =
    input.writeWarning ??
    ((line: string) => {
      process.stderr.write(`${sanitizeTerminalText(line)}\n`);
    });
  const llmConfig = resolveConfig(env);

  let targetLanguage: string;
  try {
    targetLanguage = await normalizeTarget({
      target: input.translateOption.target,
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      timeoutMs: llmConfig.timeoutMs,
      maxRetries: llmConfig.maxRetries,
    });
  } catch (error: unknown) {
    if (error instanceof LanguageNormalizationError) {
      throw new UsageError(error.message);
    }

    throw error;
  }

  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(
    `translating (${targetLanguage}) with ${llmConfig.provider}/${llmConfig.model}`
  );

  const abortController = new AbortController();
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };
  let sigIntRegistered = false;

  process.once("SIGINT", onSigInt);
  sigIntRegistered = true;
  loading.start();

  try {
    const chunkCount = splitIntoTranslationChunks(input.documentContent).length;
    const chunkWaves = Math.max(1, Math.ceil(chunkCount / DEFAULT_TRANSLATE_CONCURRENCY));
    const baseTimeoutMs = resolveAdaptiveTimeoutMs(llmConfig.timeoutMs, input.documentContent);
    const timeoutMs = Math.min(baseTimeoutMs * chunkWaves, llmConfig.timeoutMs * 12);
    const timeoutDeadlineMs = createTimeoutDeadline(timeoutMs);

    const translated = await translateContentInChunks({
      content: input.documentContent,
      translateChunk: async (chunk) =>
        translate({
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: llmConfig.apiKey,
          targetLanguage,
          input: chunk,
          timeoutMs,
          maxRetries: llmConfig.maxRetries,
          signal: abortController.signal,
          timeoutDeadlineMs,
        }),
    });

    loading.stop();
    loading.succeed("translation ready; starting RSVP");

    return {
      readingContent: translated,
      sourceLabel: `${input.sourceLabel} (translated:${targetLanguage})`,
    };
  } catch (error: unknown) {
    if (error instanceof TranslateRuntimeError) {
      if (error.stage === "timeout") {
        if (sigIntRegistered) {
          process.removeListener("SIGINT", onSigInt);
          sigIntRegistered = false;
        }

        const outcome = await resolveTimeoutOutcome({
          transformLabel: "translation",
          isInteractive,
          allowNonInteractiveContinue,
        });

        if (outcome === "continue") {
          loading.stop();
          writeWarning("[warn] translation timed out; continuing without translation transform");
          return {
            readingContent: input.documentContent,
            sourceLabel: input.sourceLabel,
          };
        }
      }

      loading.stop();
      loading.fail("translation failed");

      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      throw new TranslateRuntimeError(
        `${error.message} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    loading.stop();
    loading.fail("translation failed");
    throw new TranslateRuntimeError(
      `Translation failed [runtime]: ${sanitizeTerminalText(message)}`,
      "runtime"
    );
  } finally {
    if (sigIntRegistered) {
      process.removeListener("SIGINT", onSigInt);
    }
  }
}
