import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { SummarizeRuntimeError } from "../cli/errors";
import type { SummaryPreset } from "../cli/summary-option";
import type { LLMProvider } from "../config/llm-config";
import { assertInputWithinLimit } from "../ingest/constants";

export const MAX_SUMMARY_BYTES = 512 * 1024;

export const SummaryResponseSchema = z.object({
  summary: z.string().trim().min(1).max(50_000),
});

export interface SummarizeInput {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  preset: SummaryPreset;
  input: string;
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
}

export type StructuredGenerator = (input: {
  model: LanguageModel;
  schema: typeof SummaryResponseSchema;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ object: { summary: string } }>;

export function buildSummaryPrompt(input: string, preset: SummaryPreset): string {
  const targetGuidance =
    preset === "short"
      ? "Target approximately 4-8 concise sentences."
      : preset === "medium"
        ? "Target approximately 8-14 concise sentences."
        : "Target approximately 14-22 concise sentences with useful details.";

  return [
    "You summarize text for speed reading.",
    `Preset: ${preset}`,
    "Return a single coherent summary preserving key meaning and chronology.",
    "Avoid bullet points, markdown, and headings.",
    targetGuidance,
    "Text to summarize:",
    input,
  ].join("\n\n");
}

export function normalizeSummaryText(value: string): string {
  return value.trim();
}

function createModel(provider: LLMProvider, modelName: string, apiKey: string): LanguageModel {
  if (provider === "openai") {
    const providerFactory = createOpenAI({ apiKey });
    return providerFactory(modelName);
  }

  if (provider === "anthropic") {
    const providerFactory = createAnthropic({ apiKey });
    return providerFactory(modelName);
  }

  const providerFactory = createGoogleGenerativeAI({ apiKey });
  return providerFactory(modelName);
}

function mergedAbortSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("timeout"));
  }, timeoutMs);

  const onAbort = () => {
    controller.abort(parentSignal?.reason ?? new Error("aborted"));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      onAbort();
    } else {
      parentSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  const dispose = () => {
    clearTimeout(timeoutId);
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onAbort);
    }
  };

  controller.signal.addEventListener("abort", dispose, { once: true });

  return {
    signal: controller.signal,
    dispose,
  };
}

function isTransientRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500")
  );
}

function classifyRuntimeError(error: unknown): SummarizeRuntimeError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("abort") || lower.includes("sigint") || lower.includes("cancel")) {
    return new SummarizeRuntimeError(
      "Summarization failed [timeout]: request cancelled.",
      "timeout"
    );
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new SummarizeRuntimeError(
      "Summarization failed [timeout]: request timed out.",
      "timeout"
    );
  }

  if (lower.includes("schema") || lower.includes("object") || lower.includes("json")) {
    return new SummarizeRuntimeError(
      "Summarization failed [schema]: provider returned invalid structured output.",
      "schema"
    );
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return new SummarizeRuntimeError(
      "Summarization failed [network]: unable to reach provider.",
      "network"
    );
  }

  if (lower.includes("auth") || lower.includes("key") || lower.includes("unauthorized")) {
    return new SummarizeRuntimeError(
      "Summarization failed [provider]: authentication failed for selected provider/model.",
      "provider"
    );
  }

  return new SummarizeRuntimeError(
    `Summarization failed [runtime]: ${message}`,
    "runtime"
  );
}

function getRetryDelayMs(attempt: number): number {
  const base = 200;
  const capped = Math.min(2_000, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 100);
  return capped + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function summarizeTextWithGenerator(
  input: SummarizeInput,
  generate: StructuredGenerator
): Promise<string> {
  const model = createModel(input.provider, input.model, input.apiKey);
  const prompt = buildSummaryPrompt(input.input, input.preset);

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    try {
      const { signal, dispose } = mergedAbortSignal(input.timeoutMs, input.signal);
      const result = await generate({
        model,
        schema: SummaryResponseSchema,
        prompt,
        abortSignal: signal,
      }).finally(dispose);

      const normalized = normalizeSummaryText(result.object.summary);
      if (!normalized) {
        throw new SummarizeRuntimeError(
          "Summarization failed [schema]: summary text is empty.",
          "schema"
        );
      }

      assertInputWithinLimit(Buffer.byteLength(normalized, "utf8"), MAX_SUMMARY_BYTES);

      return normalized;
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= input.maxRetries || !isTransientRuntimeError(error)) {
        break;
      }

      await sleep(getRetryDelayMs(attempt));

      attempt += 1;
    }
  }

  throw classifyRuntimeError(lastError);
}

export async function summarizeText(input: SummarizeInput): Promise<string> {
  return summarizeTextWithGenerator(input, async (params) => {
    const result = await generateObject(params);
    return {
      object: {
        summary: result.object.summary,
      },
    };
  });
}
