import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { LLMProvider } from "../config/llm-config";

export type LanguageNormalizationErrorCode =
  | "TARGET_MISSING"
  | "TARGET_INVALID"
  | "TARGET_AMBIGUOUS"
  | "TARGET_UNRESOLVED";

export class LanguageNormalizationError extends Error {
  readonly code: LanguageNormalizationErrorCode;

  constructor(code: LanguageNormalizationErrorCode, message: string) {
    super(message);
    this.name = "LanguageNormalizationError";
    this.code = code;
  }
}

export interface LanguageNormalizerInput {
  target: string;
  provider: LLMProvider;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
}

export const LanguageNormalizerSchema = z.object({
  tag: z.string().trim().min(2).max(16).nullable(),
  ambiguous: z.boolean(),
});

type LanguageNormalizerGenerator = (input: {
  model: LanguageModel;
  schema: typeof LanguageNormalizerSchema;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ object: { tag: string | null; ambiguous: boolean } }>;

const DIRECT_NAME_MAP: Record<string, string> = {
  english: "en",
  ingles: "en",
  inglish: "en",
  spanish: "es",
  espanol: "es",
  "español": "es",
  french: "fr",
  portuguese: "pt",
  portugues: "pt",
  german: "de",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
};

const AMBIGUOUS_NAMES = new Set(["chinese"]);
const MAX_TARGET_LENGTH = 64;

function createModel(provider: LLMProvider, modelName: string, apiKey: string): LanguageModel {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(modelName);
  }

  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(modelName);
  }

  return createGoogleGenerativeAI({ apiKey })(modelName);
}

function canonicalizeTag(tag: string): string {
  const parts = tag.split("-").filter(Boolean);
  if (parts.length === 0) {
    throw new LanguageNormalizationError("TARGET_INVALID", "Invalid target language.");
  }

  const canonical = parts.map((part, index) => {
    if (index === 0) {
      return part.toLowerCase();
    }

    if (part.length === 2) {
      return part.toUpperCase();
    }

    return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
  });

  const normalized = canonical.join("-");
  if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{3}|-[A-Z]{2}|-[A-Za-z0-9]{2,8})*$/.test(normalized)) {
    throw new LanguageNormalizationError("TARGET_INVALID", "Invalid target language.");
  }

  return normalized;
}

function resolveLocalTarget(target: string): string | null {
  const normalized = target.trim().toLowerCase();
  if (!normalized) {
    throw new LanguageNormalizationError("TARGET_MISSING", "Missing --translate-to target.");
  }

  if (normalized.length > MAX_TARGET_LENGTH) {
    throw new LanguageNormalizationError(
      "TARGET_INVALID",
      "Invalid --translate-to value. Provide a target language."
    );
  }

  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new LanguageNormalizationError(
      "TARGET_INVALID",
      "Invalid --translate-to value. Provide a target language."
    );
  }

  if (
    /^https?:\/\//i.test(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes(".")
  ) {
    throw new LanguageNormalizationError(
      "TARGET_INVALID",
      "Invalid --translate-to value. Provide a target language."
    );
  }

  if (AMBIGUOUS_NAMES.has(normalized)) {
    throw new LanguageNormalizationError(
      "TARGET_AMBIGUOUS",
      "Ambiguous --translate-to target. Please be more specific."
    );
  }

  if (/^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(normalized)) {
    return canonicalizeTag(normalized);
  }

  if (DIRECT_NAME_MAP[normalized]) {
    return canonicalizeTag(DIRECT_NAME_MAP[normalized]);
  }

  if (/^[a-z]{2,20}$/.test(normalized)) {
    throw new LanguageNormalizationError(
      "TARGET_UNRESOLVED",
      "Unresolved --translate-to target. Use a different language value."
    );
  }

  return null;
}

function buildNormalizerPrompt(target: string): string {
  return [
    "Normalize a requested language into a canonical BCP-47 language tag.",
    "Return ambiguous=true when the target name is ambiguous.",
    "Return tag as null if unresolved.",
    "Input target:",
    target,
  ].join("\n\n");
}

async function mergedSignal(timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  const onAbort = () => controller.abort(parentSignal?.reason ?? new Error("aborted"));
  if (parentSignal) {
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", onAbort);
      }
    },
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

function getRetryDelayMs(attempt: number): number {
  const base = 200;
  const capped = Math.min(2_000, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 100);
  return capped + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function normalizeTargetLanguageWithGenerator(
  input: LanguageNormalizerInput,
  generate: LanguageNormalizerGenerator
): Promise<string> {
  const local = resolveLocalTarget(input.target);
  if (local) {
    return local;
  }

  const model = createModel(input.provider, input.model, input.apiKey);
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    try {
      const { signal, dispose } = await mergedSignal(input.timeoutMs, input.signal);

      const result = await generate({
        model,
        schema: LanguageNormalizerSchema,
        prompt: buildNormalizerPrompt(input.target),
        abortSignal: signal,
      }).finally(dispose);

      if (result.object.ambiguous) {
        throw new LanguageNormalizationError(
          "TARGET_AMBIGUOUS",
          "Ambiguous --translate-to target. Please be more specific."
        );
      }

      if (!result.object.tag) {
        throw new LanguageNormalizationError(
          "TARGET_UNRESOLVED",
          "Unresolved --translate-to target. Use a different language value."
        );
      }

      return canonicalizeTag(result.object.tag);
    } catch (error: unknown) {
      lastError = error;
      if (error instanceof LanguageNormalizationError) {
        throw error;
      }

      if (attempt >= input.maxRetries || !isTransientRuntimeError(error)) {
        break;
      }

      await sleep(getRetryDelayMs(attempt));
      attempt += 1;
    }
  }

  throw lastError;
}

export async function normalizeTargetLanguage(input: LanguageNormalizerInput): Promise<string> {
  return normalizeTargetLanguageWithGenerator(input, async (params) => {
    const result = await generateObject(params);
    return {
      object: {
        tag: result.object.tag,
        ambiguous: result.object.ambiguous,
      },
    };
  });
}
