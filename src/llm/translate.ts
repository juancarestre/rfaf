import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { LLMProvider } from "../config/llm-config";
import { assertInputWithinLimit } from "../ingest/constants";
import { TranslateRuntimeError } from "../cli/errors";
import {
  createTimeoutDeadline,
  resolveAdaptiveTimeoutMs,
  resolveRemainingTimeoutMs,
} from "./timeout-policy";

export const MAX_TRANSLATE_BYTES = 512 * 1024;

const TARGET_LANGUAGE_FAILURE_REASON = "target language check failed";
const CONTENT_PRESERVATION_FAILURE_REASON = "content preservation check failed";

const ENGLISH_MARKER_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "for",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
]);

const SPANISH_MARKER_WORDS = new Set([
  "que",
  "los",
  "las",
  "para",
  "como",
  "una",
  "con",
  "del",
  "por",
  "sus",
  "pero",
  "entre",
  "sobre",
]);

const LATIN_WORD_REGEX = /\p{Script=Latin}+/gu;
const NON_LATIN_SCRIPT_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Greek}]/u;

export const TranslateResponseSchema = z.object({
  translated_text: z.string().trim().min(1).max(80_000),
});

export interface TranslateInput {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  targetLanguage: string;
  input: string;
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
  timeoutDeadlineMs?: number;
}

export type TranslateGenerator = (input: {
  model: LanguageModel;
  schema: typeof TranslateResponseSchema;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ object: { translated_text: string } }>;

export function buildTranslatePrompt(input: string, targetLanguage: string): string {
  return [
    "Translate text for speed reading while preserving meaning and chronology.",
    `Translate into target language: ${targetLanguage}.`,
    "Translate the complete text.",
    "Do not summarize, omit sections, or shorten the content.",
    "Do not add new facts.",
    "Return plain text only.",
    "Text to translate:",
    input,
  ].join("\n\n");
}

export function normalizeTranslatedText(value: string): string {
  return value.trim();
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

function latinWords(text: string): string[] {
  return text.toLowerCase().match(LATIN_WORD_REGEX) ?? [];
}

function isHighConfidenceEnglish(text: string): boolean {
  const words = latinWords(text);
  if (words.length < 6) {
    return false;
  }

  let hits = 0;
  for (const word of words) {
    if (ENGLISH_MARKER_WORDS.has(word)) {
      hits += 1;
    }
  }

  return hits >= 3 && hits / words.length >= 0.2;
}

function isLikelyEnglish(text: string): boolean {
  const words = latinWords(text);
  if (words.length < 8) {
    return false;
  }

  const hits = countMarkerHits(words, ENGLISH_MARKER_WORDS);
  return hits >= 2 && hits / words.length >= 0.12;
}

function countMarkerHits(words: string[], markers: Set<string>): number {
  let hits = 0;
  for (const word of words) {
    if (markers.has(word)) {
      hits += 1;
    }
  }

  return hits;
}

function shouldSkipTranslation(input: string, targetLanguage: string): boolean {
  const target = targetLanguage.toLowerCase();
  if (target.startsWith("en")) {
    return isHighConfidenceEnglish(input);
  }

  if (target.startsWith("ja")) {
    return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(input);
  }

  if (target.startsWith("ko")) {
    return /\p{Script=Hangul}/u.test(input);
  }

  if (target.startsWith("zh")) {
    return /\p{Script=Han}/u.test(input);
  }

  if (target.startsWith("es")) {
    const words = latinWords(input);
    if (words.length < 24) {
      return false;
    }

    const hits = countMarkerHits(words, SPANISH_MARKER_WORDS);
    const ratio = hits / words.length;
    const hasSpanishDiacritics = /[áéíóúñü]/iu.test(input);

    if (hasSpanishDiacritics) {
      return hits >= 2 && ratio >= 0.08;
    }

    return hits >= 6 && ratio >= 0.12;
  }

  if (NON_LATIN_SCRIPT_REGEX.test(input) && !target.startsWith("en")) {
    return false;
  }

  return false;
}

function violatesTargetLanguageExpectation(
  source: string,
  translated: string,
  targetLanguage: string
): boolean {
  const target = targetLanguage.toLowerCase();

  if (target.startsWith("en")) {
    return false;
  }

  if (target.startsWith("ja")) {
    return !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(translated);
  }

  if (target.startsWith("ko")) {
    return !/\p{Script=Hangul}/u.test(translated);
  }

  if (target.startsWith("zh")) {
    return !/\p{Script=Han}/u.test(translated);
  }

  if (target.startsWith("es")) {
    return isLikelyEnglish(translated);
  }

  if (isLikelyEnglish(source) && isLikelyEnglish(translated)) {
    return true;
  }

  return false;
}

function violatesContentPreservation(source: string, translated: string): boolean {
  const sourceTrimmed = source.trim();
  const translatedTrimmed = translated.trim();

  if (!sourceTrimmed || !translatedTrimmed) {
    return false;
  }

  const sourceBytes = Buffer.byteLength(sourceTrimmed, "utf8");
  if (sourceBytes < 1_200) {
    return false;
  }

  const translatedBytes = Buffer.byteLength(translatedTrimmed, "utf8");
  const byteRatio = translatedBytes / sourceBytes;
  if (byteRatio < 0.2) {
    return true;
  }

  const sourceParagraphs = sourceTrimmed.split(/\n{2,}/).filter(Boolean).length;
  const translatedParagraphs = translatedTrimmed.split(/\n{2,}/).filter(Boolean).length;

  return sourceParagraphs >= 4 && translatedParagraphs <= 1 && byteRatio < 0.45;
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

function classifyRuntimeError(error: unknown): TranslateRuntimeError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("abort") || lower.includes("sigint") || lower.includes("cancel")) {
    return new TranslateRuntimeError("Translation failed [timeout]: request cancelled.", "timeout");
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    return new TranslateRuntimeError("Translation failed [timeout]: request timed out.", "timeout");
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return new TranslateRuntimeError("Translation failed [network]: unable to reach provider.", "network");
  }

  if (lower.includes(TARGET_LANGUAGE_FAILURE_REASON)) {
    return new TranslateRuntimeError(
      "Translation failed [schema]: target language check failed; translated text does not match requested target.",
      "schema"
    );
  }

  if (lower.includes(CONTENT_PRESERVATION_FAILURE_REASON)) {
    return new TranslateRuntimeError(
      "Translation failed [schema]: content preservation check failed; translation appears summarized or truncated.",
      "schema"
    );
  }

  if (lower.includes("schema") || lower.includes("json") || lower.includes("object")) {
    return new TranslateRuntimeError(
      "Translation failed [schema]: provider returned invalid structured output.",
      "schema"
    );
  }

  if (lower.includes("unsupported language") || lower.includes("unsupported target")) {
    return new TranslateRuntimeError(
      "Translation failed [provider]: target language is not supported by provider/model.",
      "provider"
    );
  }

  if (lower.includes("auth") || lower.includes("key") || lower.includes("unauthorized")) {
    return new TranslateRuntimeError(
      "Translation failed [provider]: authentication failed for selected provider/model.",
      "provider"
    );
  }

  return new TranslateRuntimeError(
    "Translation failed [runtime]: unexpected provider runtime error.",
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
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }

  const dispose = () => {
    clearTimeout(timeoutId);
    if (parentSignal) parentSignal.removeEventListener("abort", onAbort);
  };

  controller.signal.addEventListener("abort", dispose, { once: true });

  return { signal: controller.signal, dispose };
}

export async function translateTextWithGenerator(
  input: TranslateInput,
  generate: TranslateGenerator
): Promise<string> {
  if (shouldSkipTranslation(input.input, input.targetLanguage)) {
    return input.input;
  }

  const model = createModel(input.provider, input.model, input.apiKey);
  const prompt = buildTranslatePrompt(input.input, input.targetLanguage);
  const timeoutDeadlineMs =
    input.timeoutDeadlineMs ??
    createTimeoutDeadline(resolveAdaptiveTimeoutMs(input.timeoutMs, input.input));

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    const remainingTimeoutMs = resolveRemainingTimeoutMs(timeoutDeadlineMs);
    if (remainingTimeoutMs <= 0) {
      lastError = new TranslateRuntimeError("Translation failed [timeout]: request timed out.", "timeout");
      break;
    }

    try {
      const { signal, dispose } = mergedAbortSignal(Math.max(1, remainingTimeoutMs), input.signal);
      const result = await generate({
        model,
        schema: TranslateResponseSchema,
        prompt,
        abortSignal: signal,
      }).finally(dispose);

      const normalized = normalizeTranslatedText(result.object.translated_text);
      if (!normalized) {
        throw new TranslateRuntimeError(
          "Translation failed [schema]: translated text is empty.",
          "schema"
        );
      }

      if (violatesTargetLanguageExpectation(input.input, normalized, input.targetLanguage)) {
        throw new TranslateRuntimeError(
          `Translation failed [schema]: ${TARGET_LANGUAGE_FAILURE_REASON}; translated text does not match requested target.`,
          "schema"
        );
      }

      if (violatesContentPreservation(input.input, normalized)) {
        throw new TranslateRuntimeError(
          `Translation failed [schema]: ${CONTENT_PRESERVATION_FAILURE_REASON}; translation appears summarized or truncated.`,
          "schema"
        );
      }

      if (resolveRemainingTimeoutMs(timeoutDeadlineMs) <= 0) {
        throw new TranslateRuntimeError("Translation failed [timeout]: request timed out.", "timeout");
      }

      assertInputWithinLimit(Buffer.byteLength(normalized, "utf8"), MAX_TRANSLATE_BYTES);
      return normalized;
    } catch (error: unknown) {
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

export async function translateText(input: TranslateInput): Promise<string> {
  return translateTextWithGenerator(input, async (params) => {
    const result = await generateObject(params);
    return {
      object: {
        translated_text: result.object.translated_text,
      },
    };
  });
}
