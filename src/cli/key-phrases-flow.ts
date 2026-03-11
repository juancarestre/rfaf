import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import { extractKeyPhrases, type KeyPhrasesInput } from "../llm/key-phrases";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import { KeyPhrasesRuntimeError } from "./errors";
import type { KeyPhrasesOption } from "./key-phrases-option";
import {
  resolveTimeoutRecoveryOutcome,
  type TimeoutRecoveryOutcome,
} from "./timeout-recovery";

export interface KeyPhrasesFlowInput {
  documentContent: string;
  sourceLabel: string;
  keyPhrasesOption: KeyPhrasesOption;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  runExtract?: typeof extractKeyPhrases;
  createLoading?: (message: string) => LoadingIndicator;
  resolveTimeoutOutcome?: (input: {
    transformLabel: string;
    isInteractive: boolean;
  }) => Promise<TimeoutRecoveryOutcome>;
  isInteractive?: boolean;
  writeWarning?: (line: string) => void;
}

export interface KeyPhrasesFlowOutput {
  readingContent: string;
  sourceLabel: string;
  keyPhrases: string[];
}

export async function keyPhrasesBeforeRsvp(
  input: KeyPhrasesFlowInput
): Promise<KeyPhrasesFlowOutput> {
  if (!input.keyPhrasesOption.enabled || !input.keyPhrasesOption.maxPhrases) {
    return {
      readingContent: input.documentContent,
      sourceLabel: input.sourceLabel,
      keyPhrases: [],
    };
  }

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const runExtract = input.runExtract ?? extractKeyPhrases;
  const resolveTimeoutOutcome = input.resolveTimeoutOutcome ?? resolveTimeoutRecoveryOutcome;
  const isInteractive = input.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const writeWarning =
    input.writeWarning ??
    ((line: string) => {
      process.stderr.write(`${sanitizeTerminalText(line)}\n`);
    });
  const llmConfig = resolveConfig(env);

  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(
    `extracting key phrases with ${llmConfig.provider}/${llmConfig.model}`
  );

  const abortController = new AbortController();
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };

  process.once("SIGINT", onSigInt);
  loading.start();

  try {
    const keyPhrases = await runExtract({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      input: input.documentContent,
      maxPhrases: input.keyPhrasesOption.maxPhrases,
      timeoutMs: llmConfig.timeoutMs,
      maxRetries: llmConfig.maxRetries,
      signal: abortController.signal,
    } satisfies KeyPhrasesInput);

    if (keyPhrases.length === 0) {
      throw new KeyPhrasesRuntimeError(
        "Key-phrases failed [schema]: extracted key phrases are empty.",
        "schema"
      );
    }

    loading.stop();
    loading.succeed("key phrases ready; starting RSVP");

    return {
      readingContent: input.documentContent,
      sourceLabel: `${input.sourceLabel} (key-phrases)`,
      keyPhrases,
    };
  } catch (error: unknown) {
    loading.stop();
    loading.fail("key-phrases failed");

    if (error instanceof KeyPhrasesRuntimeError) {
      if (error.stage === "timeout") {
        const outcome = await resolveTimeoutOutcome({
          transformLabel: "key-phrases",
          isInteractive,
        });

        if (outcome === "continue") {
          writeWarning("[warn] key-phrases timed out; continuing without key-phrases transform");
          return {
            readingContent: input.documentContent,
            sourceLabel: input.sourceLabel,
            keyPhrases: [],
          };
        }
      }

      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      throw new KeyPhrasesRuntimeError(
        `${error.message} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new KeyPhrasesRuntimeError(
      `Key-phrases failed [runtime]: ${sanitizeTerminalText(message)}`,
      "runtime"
    );
  } finally {
    process.removeListener("SIGINT", onSigInt);
  }
}
