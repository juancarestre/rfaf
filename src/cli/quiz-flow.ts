import { createInterface } from "node:readline/promises";
import { loadLLMConfig, type LLMConfig } from "../config/llm-config";
import { generateQuiz, type QuizInput, type QuizQuestion, type QuizResult } from "../llm/quiz";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { createLoadingIndicator, type LoadingIndicator } from "./loading-indicator";
import { QuizRuntimeError } from "./errors";
import type { QuizOption } from "./quiz-option";

export interface QuizFlowInput {
  documentContent: string;
  sourceLabel: string;
  quizOption: QuizOption;
  inputStream?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WriteStream;
  env?: Record<string, string | undefined>;
  loadConfig?: (env: Record<string, string | undefined>) => LLMConfig;
  generateQuiz?: (input: QuizInput) => Promise<QuizResult>;
  createLoading?: (message: string) => LoadingIndicator;
  askAnswer?: (prompt: string, questionIndex: number, question: QuizQuestion) => Promise<string>;
  writeLine?: (line: string) => void;
}

export interface QuizFlowOutput {
  sourceLabel: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  missedTopics: string[];
}

function toAnswerIndex(raw: string): number | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "a") return 0;
  if (normalized === "2" || normalized === "b") return 1;
  if (normalized === "3" || normalized === "c") return 2;
  if (normalized === "4" || normalized === "d") return 3;
  return null;
}

export async function runStandaloneQuiz(input: QuizFlowInput): Promise<QuizFlowOutput | null> {
  if (!input.quizOption.enabled) {
    return null;
  }

  const output = input.outputStream ?? process.stdout;
  const writeLine =
    input.writeLine ??
    ((line: string) => {
      output.write(`${sanitizeTerminalText(line)}\n`);
    });

  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const resolveConfig = input.loadConfig ?? loadLLMConfig;
  const runGenerateQuiz = input.generateQuiz ?? generateQuiz;
  const llmConfig = resolveConfig(env);

  let closeAsk = () => {};
  const ask =
    input.askAnswer ??
    (() => {
      const rl = createInterface({
        input: (input.inputStream ?? process.stdin) as NodeJS.ReadableStream,
        output,
        terminal: output.isTTY,
      });

      closeAsk = () => rl.close();

      return async (prompt: string) => rl.question(prompt);
    })();

  const loadingFactory =
    input.createLoading ??
    ((message: string) =>
      createLoadingIndicator({
        message,
      }));

  const loading = loadingFactory(`generating quiz with ${llmConfig.provider}/${llmConfig.model}`);

  const abortController = new AbortController();
  const onSigInt = () => {
    abortController.abort(new Error("SIGINT"));
  };

  let quiz: QuizResult;

  try {
    process.once("SIGINT", onSigInt);
    loading.start();

    quiz = await runGenerateQuiz({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      input: input.documentContent,
      timeoutMs: llmConfig.timeoutMs,
      maxRetries: llmConfig.maxRetries,
      signal: abortController.signal,
    });

    loading.stop();
    loading.succeed("quiz ready; starting questions");
  } catch (error: unknown) {
    loading.stop();
    loading.fail("quiz generation failed");

    if (error instanceof QuizRuntimeError) {
      const provider = sanitizeTerminalText(llmConfig.provider);
      const model = sanitizeTerminalText(llmConfig.model);
      throw new QuizRuntimeError(
        `${error.message} (provider=${provider}, model=${model})`,
        error.stage
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new QuizRuntimeError(`Quiz failed [runtime]: ${sanitizeTerminalText(message)}`, "runtime");
  } finally {
    process.removeListener("SIGINT", onSigInt);
  }

  let correctAnswers = 0;
  const missedTopicSet = new Set<string>();

  try {
    writeLine("");
    writeLine(`Quiz source: ${input.sourceLabel}`);

    for (let index = 0; index < quiz.questions.length; index++) {
      const question = quiz.questions[index];

      writeLine("");
      writeLine(`Q${index + 1}/${quiz.questions.length}: ${question.question}`);
      writeLine(`  A) ${question.options[0]}`);
      writeLine(`  B) ${question.options[1]}`);
      writeLine(`  C) ${question.options[2]}`);
      writeLine(`  D) ${question.options[3]}`);

      let answerIndex: number | null = null;
      while (answerIndex === null) {
        const answerRaw = await ask("Answer [1-4 or A-D]: ", index, question);

        answerIndex = toAnswerIndex(answerRaw);
        if (answerIndex === null) {
          writeLine("Invalid answer. Use 1-4 or A-D.");
        }
      }

      if (answerIndex === question.correctIndex) {
        correctAnswers += 1;
      } else {
        missedTopicSet.add(question.topic);
      }
    }
  } catch (error: unknown) {
    if (error instanceof QuizRuntimeError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new QuizRuntimeError(
      `Quiz failed [runtime]: ${sanitizeTerminalText(message || "interactive quiz loop failed")}`,
      "runtime"
    );
  } finally {
    closeAsk();
  }

  const totalQuestions = quiz.questions.length;
  const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
  const missedTopics = [...missedTopicSet];

  const result: QuizFlowOutput = {
    sourceLabel: input.sourceLabel,
    totalQuestions,
    correctAnswers,
    scorePercent,
    missedTopics,
  };

  writeLine("");
  writeLine("Quiz complete.");
  writeLine(`Score: ${result.correctAnswers}/${result.totalQuestions} (${result.scorePercent}%)`);
  writeLine(
    result.missedTopics.length > 0
      ? `Missed topics: ${result.missedTopics.join(", ")}`
      : "Missed topics: none"
  );

  return result;
}
