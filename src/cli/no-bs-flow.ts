import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import { noBsText, type NoBsInput } from "../llm/no-bs";
import { applyDeterministicNoBs } from "../processor/no-bs-cleaner";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import { NoBsRuntimeError } from "./errors";
import type { NoBsOption } from "./no-bs-option";

export interface NoBsFlowInput {
  documentContent: string;
  sourceLabel: string;
  noBsOption: NoBsOption;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  runNoBs?: typeof noBsText;
  createLoading?: (message: string) => LoadingIndicator;
  cleanText?: typeof applyDeterministicNoBs;
}

export interface NoBsFlowOutput {
  readingContent: string;
  sourceLabel: string;
}

export async function noBsBeforeRsvp(input: NoBsFlowInput): Promise<NoBsFlowOutput> {
  if (!input.noBsOption.enabled) {
    return {
      readingContent: input.documentContent,
      sourceLabel: input.sourceLabel,
    };
  }

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const runNoBs = input.runNoBs ?? noBsText;
  const cleanText = input.cleanText ?? applyDeterministicNoBs;
  const cleaned = cleanText(input.documentContent);

  if (!cleaned.trim()) {
    throw new NoBsRuntimeError(
      "No-BS failed [schema]: no-bs produced empty text.",
      "schema"
    );
  }

  const llmConfig = resolveConfig(env);
  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(
    `cleaning (--no-bs) with ${llmConfig.provider}/${llmConfig.model}`
  );

  const abortController = new AbortController();
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };

  let loadingStarted = false;

  try {
    process.once("SIGINT", onSigInt);
    loading.start();
    loadingStarted = true;

    const focused = await runNoBs({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      input: cleaned,
      timeoutMs: llmConfig.timeoutMs,
      maxRetries: llmConfig.maxRetries,
      signal: abortController.signal,
    } satisfies NoBsInput);

    if (!focused.trim()) {
      throw new NoBsRuntimeError(
        "No-BS failed [schema]: no-bs produced empty text.",
        "schema"
      );
    }

    loading.stop();
    loading.succeed("no-bs ready; starting RSVP");

    return {
      readingContent: focused.trim(),
      sourceLabel: `${input.sourceLabel} (no-bs)`,
    };
  } catch (error: unknown) {
    if (loadingStarted) {
      loading.stop();
      loading.fail("no-bs failed");
    }

    if (error instanceof NoBsRuntimeError) {
      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      throw new NoBsRuntimeError(
        `${error.message} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new NoBsRuntimeError(
      `No-BS failed [runtime]: ${sanitizeTerminalText(message)}`,
      "runtime"
    );
  } finally {
    process.removeListener("SIGINT", onSigInt);
  }
}
