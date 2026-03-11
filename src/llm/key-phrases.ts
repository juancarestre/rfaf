import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { KeyPhrasesRuntimeError } from "../cli/errors";
import type { LLMProvider } from "../config/llm-config";
import {
  createTimeoutDeadline,
  resolveAdaptiveTimeoutMs,
  resolveRemainingTimeoutMs,
} from "./timeout-policy";

const EDGE_PUNCTUATION_REGEX = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export const KeyPhrasesResponseSchema = z.object({
  phrases: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
});

export interface KeyPhrasesInput {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  input: string;
  maxPhrases: number;
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
  timeoutDeadlineMs?: number;
}

export type KeyPhrasesGenerator = (input: {
  model: LanguageModel;
  schema: typeof KeyPhrasesResponseSchema;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ object: { phrases: string[] } }>;

function normalizeComparableToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(EDGE_PUNCTUATION_REGEX, "");
}

function toComparableTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => normalizeComparableToken(token))
    .filter((token) => token.length > 0);
}

function phraseTokens(phrase: string): string[] {
  return toComparableTokens(phrase);
}

function phraseExistsInSource(sourceTokens: string[], phrase: string): boolean {
  const tokens = phraseTokens(phrase);
  if (tokens.length === 0 || tokens.length > sourceTokens.length) {
    return false;
  }

  const firstToken = tokens[0];
  if (!firstToken) {
    return false;
  }

  for (let index = 0; index <= sourceTokens.length - tokens.length; index++) {
    if (sourceTokens[index] !== firstToken) {
      continue;
    }

    let matched = true;
    for (let offset = 1; offset < tokens.length; offset++) {
      if (sourceTokens[index + offset] !== tokens[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return true;
    }
  }

  return false;
}

function validateGroundedPhrases(phrases: string[], source: string): string[] {
  const sourceTokens = toComparableTokens(source);
  if (sourceTokens.length === 0) {
    throw new KeyPhrasesRuntimeError(
      "Key-phrases failed [schema]: source text is empty after normalization.",
      "schema"
    );
  }

  const ungrounded = phrases.filter((phrase) => !phraseExistsInSource(sourceTokens, phrase));
  if (ungrounded.length > 0) {
    throw new KeyPhrasesRuntimeError(
      "Key-phrases failed [schema]: grounding check failed; extracted phrases must exist in source text.",
      "schema"
    );
  }

  return phrases;
}

function createModel(provider: LLMProvider, modelName: string, apiKey: string): LanguageModel {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(modelName);
  }

  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(modelName);
  }

  return createGoogleGenerativeAI({ apiKey })(modelName);
}

function mergedAbortSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

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
  return { signal: controller.signal, dispose };
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

function classifyRuntimeError(error: unknown): KeyPhrasesRuntimeError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("abort") || lower.includes("sigint") || lower.includes("cancel")) {
    return new KeyPhrasesRuntimeError("Key-phrases failed [timeout]: request cancelled.", "timeout");
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new KeyPhrasesRuntimeError("Key-phrases failed [timeout]: request timed out.", "timeout");
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return new KeyPhrasesRuntimeError(
      "Key-phrases failed [network]: unable to reach provider.",
      "network"
    );
  }

  if (lower.includes("schema") || lower.includes("json") || lower.includes("object")) {
    return new KeyPhrasesRuntimeError(
      "Key-phrases failed [schema]: provider returned invalid structured output.",
      "schema"
    );
  }

  if (lower.includes("auth") || lower.includes("key") || lower.includes("unauthorized")) {
    return new KeyPhrasesRuntimeError(
      "Key-phrases failed [provider]: authentication failed for selected provider/model.",
      "provider"
    );
  }

  return new KeyPhrasesRuntimeError(
    "Key-phrases failed [runtime]: unexpected provider runtime error.",
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

const RETRY_GUARD_MS = 150;

export function buildKeyPhrasesPrompt(input: string, maxPhrases: number): string {
  return [
    "Extract key phrases for speed reading guidance.",
    "Return only phrases copied or minimally normalized from the source text.",
    "Do not translate and do not invent new facts.",
    `Return between 5 and ${Math.max(5, maxPhrases)} phrases when possible; if the text is very short, return as many high-signal phrases as available.`,
    "Prioritize semantic importance and diversity.",
    "Keep phrase order by importance.",
    "Text to analyze:",
    input,
  ].join("\n\n");
}

export function normalizeKeyPhrases(phrases: string[], maxPhrases: number): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const phrase of phrases) {
    const normalized = phrase.trim();
    if (!normalized) {
      continue;
    }

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(normalized);

    if (deduped.length >= maxPhrases) {
      break;
    }
  }

  return deduped;
}

export async function extractKeyPhrasesWithGenerator(
  input: KeyPhrasesInput,
  generate: KeyPhrasesGenerator
): Promise<string[]> {
  const model = createModel(input.provider, input.model, input.apiKey);
  const prompt = buildKeyPhrasesPrompt(input.input, input.maxPhrases);
  const timeoutDeadlineMs =
    input.timeoutDeadlineMs ??
    createTimeoutDeadline(resolveAdaptiveTimeoutMs(input.timeoutMs, input.input));

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    const remainingTimeoutMs = resolveRemainingTimeoutMs(timeoutDeadlineMs);
    if (remainingTimeoutMs <= 0) {
      lastError = new KeyPhrasesRuntimeError(
        "Key-phrases failed [timeout]: request timed out.",
        "timeout"
      );
      break;
    }

    try {
      const { signal, dispose } = mergedAbortSignal(Math.max(1, remainingTimeoutMs), input.signal);
      const result = await generate({
        model,
        schema: KeyPhrasesResponseSchema,
        prompt,
        abortSignal: signal,
      }).finally(dispose);

      const normalized = normalizeKeyPhrases(result.object.phrases, input.maxPhrases);
      if (normalized.length === 0) {
        throw new KeyPhrasesRuntimeError(
          "Key-phrases failed [schema]: extracted key phrases are empty.",
          "schema"
        );
      }

      if (resolveRemainingTimeoutMs(timeoutDeadlineMs) <= 0) {
        throw new KeyPhrasesRuntimeError("Key-phrases failed [timeout]: request timed out.", "timeout");
      }

      return validateGroundedPhrases(normalized, input.input);
    } catch (error: unknown) {
      if (error instanceof KeyPhrasesRuntimeError) {
        throw error;
      }

      lastError = error;
      if (attempt >= input.maxRetries || !isTransientRuntimeError(error)) {
        break;
      }

      const retryRemainingMs = resolveRemainingTimeoutMs(timeoutDeadlineMs);
      if (retryRemainingMs <= RETRY_GUARD_MS) {
        break;
      }

      const delayMs = Math.min(getRetryDelayMs(attempt), Math.max(0, retryRemainingMs - RETRY_GUARD_MS));
      if (delayMs <= 0) {
        break;
      }

      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw classifyRuntimeError(lastError);
}

export async function extractKeyPhrases(input: KeyPhrasesInput): Promise<string[]> {
  return extractKeyPhrasesWithGenerator(input, async (params) => {
    const result = await generateObject(params);
    return {
      object: {
        phrases: result.object.phrases,
      },
    };
  });
}
