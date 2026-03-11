import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { SummarizeRuntimeError } from "./errors";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import type { SummaryOption, SummaryPreset } from "./summary-option";
import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import { summarizeText } from "../llm/summarize";
import {
  resolveTimeoutRecoveryOutcome,
  type TimeoutRecoveryOutcome,
} from "./timeout-recovery";

export interface SummarizeFlowInput {
  documentContent: string;
  sourceLabel: string;
  summaryOption: SummaryOption;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  summarize?: typeof summarizeText;
  createLoading?: (message: string) => LoadingIndicator;
  resolveTimeoutOutcome?: (input: {
    transformLabel: string;
    isInteractive: boolean;
  }) => Promise<TimeoutRecoveryOutcome>;
  isInteractive?: boolean;
  writeWarning?: (line: string) => void;
}

export interface SummarizeFlowOutput {
  readingContent: string;
  sourceLabel: string;
}

export async function summarizeBeforeRsvp(
  input: SummarizeFlowInput
): Promise<SummarizeFlowOutput> {
  if (!input.summaryOption.enabled) {
    return {
      readingContent: input.documentContent,
      sourceLabel: input.sourceLabel,
    };
  }

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const runSummarize = input.summarize ?? summarizeText;
  const resolveTimeoutOutcome = input.resolveTimeoutOutcome ?? resolveTimeoutRecoveryOutcome;
  const isInteractive = input.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const writeWarning =
    input.writeWarning ??
    ((line: string) => {
      process.stderr.write(`${sanitizeTerminalText(line)}\n`);
    });
  const llmConfig = resolveConfig(env);
  const effectivePreset: SummaryPreset = input.summaryOption.preset ?? llmConfig.defaultPreset;

  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(
    `summarizing (${effectivePreset}) with ${llmConfig.provider}/${llmConfig.model}`
  );

  const abortController = new AbortController();
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };

  process.once("SIGINT", onSigInt);
  loading.start();

  try {
    const summary = await runSummarize({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      preset: effectivePreset,
      input: input.documentContent,
      timeoutMs: llmConfig.timeoutMs,
      maxRetries: llmConfig.maxRetries,
      signal: abortController.signal,
    });

    loading.stop();
    loading.succeed("summary ready; starting RSVP");

    return {
      readingContent: summary,
      sourceLabel: `${input.sourceLabel} (summary:${effectivePreset})`,
    };
  } catch (error: unknown) {
    loading.stop();
    loading.fail("summarization failed");

    if (error instanceof SummarizeRuntimeError) {
      if (error.stage === "timeout") {
        const outcome = await resolveTimeoutOutcome({
          transformLabel: "summary",
          isInteractive,
        });

        if (outcome === "continue") {
          writeWarning("[warn] summary timed out; continuing without summary transform");
          return {
            readingContent: input.documentContent,
            sourceLabel: input.sourceLabel,
          };
        }
      }

      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      throw new SummarizeRuntimeError(
        `${error.message} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SummarizeRuntimeError(
      `Summarization failed [runtime]: ${sanitizeTerminalText(message)}`,
      "runtime"
    );
  } finally {
    process.removeListener("SIGINT", onSigInt);
  }
}
