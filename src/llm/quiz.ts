import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { QuizRuntimeError } from "../cli/errors";
import type { LLMProvider } from "../config/llm-config";
import { assertInputWithinLimit } from "../ingest/constants";

export const MAX_QUIZ_BYTES = 512 * 1024;
export const MIN_QUIZ_SOURCE_WORDS = 40;

const QUESTION_COUNT_FAILURE_REASON = "question count check failed";
const OPTION_UNIQUENESS_FAILURE_REASON = "option uniqueness check failed";

export const QuizQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  topic: z.string().trim().min(1).max(120),
});

export const QuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1).max(10),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export interface QuizInput {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  input: string;
  timeoutMs: number;
  maxRetries: number;
  signal?: AbortSignal;
}

export interface QuizResult {
  questions: QuizQuestion[];
}

export type QuizGenerator = (input: {
  model: LanguageModel;
  schema: typeof QuizResponseSchema;
  prompt: string;
  abortSignal: AbortSignal;
}) => Promise<{ object: QuizResult }>;

function createModel(provider: LLMProvider, modelName: string, apiKey: string): LanguageModel {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(modelName);
  }

  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(modelName);
  }

  return createGoogleGenerativeAI({ apiKey })(modelName);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/u).length;
}

export function deriveAdaptiveQuestionCount(content: string): number {
  const wordCount = countWords(content);

  if (wordCount < MIN_QUIZ_SOURCE_WORDS) {
    return 0;
  }

  if (wordCount < 400) {
    return 3;
  }

  if (wordCount < 1_200) {
    return 5;
  }

  if (wordCount < 3_000) {
    return 7;
  }

  return 10;
}

export function buildQuizPrompt(content: string, questionCount: number): string {
  return [
    "Generate a post-reading comprehension quiz.",
    `Generate exactly ${questionCount} multiple-choice questions.`,
    "Each question must have exactly 4 options.",
    "Set correctIndex to the 0-based index of the correct option.",
    "Questions must be grounded only in the provided source text.",
    "Do not introduce external facts.",
    "Include a short topic label for each question.",
    "Return JSON only.",
    "Source text:",
    content,
  ].join("\n\n");
}

export function normalizeQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((question) => ({
    question: question.question.trim(),
    options: question.options.map((option) => option.trim()),
    correctIndex: question.correctIndex,
    topic: question.topic.trim(),
  }));
}

function validateQuestions(questions: QuizQuestion[], expectedCount: number): void {
  if (questions.length !== expectedCount) {
    throw new QuizRuntimeError(
      `Quiz failed [schema]: ${QUESTION_COUNT_FAILURE_REASON}; expected ${expectedCount} questions but received ${questions.length}.`,
      "schema"
    );
  }

  for (const question of questions) {
    if (question.correctIndex < 0 || question.correctIndex > 3) {
      throw new QuizRuntimeError(
        "Quiz failed [schema]: correct answer index must be between 0 and 3.",
        "schema"
      );
    }

    const normalizedOptions = question.options.map((option) => option.trim().toLowerCase());
    if (new Set(normalizedOptions).size !== question.options.length) {
      throw new QuizRuntimeError(
        `Quiz failed [schema]: ${OPTION_UNIQUENESS_FAILURE_REASON}; each question must have unique options.`,
        "schema"
      );
    }
  }
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

function isTransientRuntimeError(error: unknown): boolean {
  if (error instanceof QuizRuntimeError) {
    return error.stage === "network" || error.stage === "timeout";
  }

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

function classifyRuntimeError(error: unknown): QuizRuntimeError {
  if (error instanceof QuizRuntimeError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("abort") || lower.includes("sigint") || lower.includes("cancel")) {
    return new QuizRuntimeError("Quiz failed [timeout]: request cancelled.", "timeout");
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new QuizRuntimeError("Quiz failed [timeout]: request timed out.", "timeout");
  }

  if (lower.includes("schema") || lower.includes("json") || lower.includes("object")) {
    return new QuizRuntimeError(
      "Quiz failed [schema]: provider returned invalid structured output.",
      "schema"
    );
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return new QuizRuntimeError("Quiz failed [network]: unable to reach provider.", "network");
  }

  if (lower.includes("auth") || lower.includes("key") || lower.includes("unauthorized")) {
    return new QuizRuntimeError(
      "Quiz failed [provider]: authentication failed for selected provider/model.",
      "provider"
    );
  }

  return new QuizRuntimeError("Quiz failed [runtime]: unexpected provider runtime error.", "runtime");
}

function getRetryDelayMs(attempt: number): number {
  const base = 200;
  return Math.min(2_000, base * 2 ** attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await sleep(ms);
    return;
  }

  if (signal.aborted) {
    throw signal.reason ?? new Error("cancelled");
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(signal.reason ?? new Error("cancelled"));
    };

    const cleanup = () => signal.removeEventListener("abort", onAbort);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function generateQuizWithGenerator(
  input: QuizInput,
  generate: QuizGenerator
): Promise<QuizResult> {
  assertInputWithinLimit(Buffer.byteLength(input.input, "utf8"), MAX_QUIZ_BYTES);

  const expectedCount = deriveAdaptiveQuestionCount(input.input);
  if (expectedCount < 1) {
    throw new QuizRuntimeError(
      `Quiz failed [schema]: insufficient source text; need at least ${MIN_QUIZ_SOURCE_WORDS} words.`,
      "schema"
    );
  }

  const model = createModel(input.provider, input.model, input.apiKey);
  const prompt = buildQuizPrompt(input.input, expectedCount);

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= input.maxRetries) {
    try {
      const { signal, dispose } = mergedAbortSignal(input.timeoutMs, input.signal);
      const result = await generate({
        model,
        schema: QuizResponseSchema,
        prompt,
        abortSignal: signal,
      }).finally(dispose);

      const normalized = normalizeQuizQuestions(result.object.questions);
      validateQuestions(normalized, expectedCount);

      return { questions: normalized };
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= input.maxRetries || !isTransientRuntimeError(error)) {
        break;
      }

      try {
        await sleepOrAbort(getRetryDelayMs(attempt), input.signal);
      } catch (abortError: unknown) {
        lastError = abortError;
        break;
      }

      attempt += 1;
    }
  }

  throw classifyRuntimeError(lastError);
}

export async function generateQuiz(input: QuizInput): Promise<QuizResult> {
  return generateQuizWithGenerator(input, async (params) => {
    const result = await generateObject(params);
    return {
      object: {
        questions: result.object.questions,
      },
    };
  });
}
