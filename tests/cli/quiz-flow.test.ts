import { describe, expect, it } from "bun:test";
import type { LoadingIndicator } from "../../src/cli/loading-indicator";
import { QuizRuntimeError } from "../../src/cli/errors";
import { runStandaloneQuiz } from "../../src/cli/quiz-flow";

describe("runStandaloneQuiz", () => {
  it("bypasses quiz flow when quiz option is disabled", async () => {
    const result = await runStandaloneQuiz({
      documentContent: "source text",
      sourceLabel: "stdin",
      quizOption: { enabled: false },
    });

    expect(result).toBeNull();
  });

  it("scores answers and reports deduplicated missed topics", async () => {
    const outputs: string[] = [];

    const result = await runStandaloneQuiz({
      documentContent: "alpha ".repeat(140),
      sourceLabel: "stdin",
      quizOption: { enabled: true },
      env: { OPENAI_API_KEY: "test" },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      generateQuiz: async () => ({
        questions: [
          {
            question: "Q1",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            topic: "Topic A",
          },
          {
            question: "Q2",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            topic: "Topic B",
          },
          {
            question: "Q3",
            options: ["A", "B", "C", "D"],
            correctIndex: 2,
            topic: "Topic A",
          },
        ],
      }),
      askAnswer: async (_question, index) => {
        if (index === 0) return "a";
        if (index === 1) return "a";
        return "d";
      },
      writeLine: (line) => outputs.push(line),
      createLoading: () => ({
        start: () => {},
        stop: () => {},
        succeed: () => {},
        fail: () => {},
      }),
    });

    expect(result).toEqual({
      sourceLabel: "stdin",
      totalQuestions: 3,
      correctAnswers: 1,
      scorePercent: 33,
      missedTopics: ["Topic A"],
    });
    expect(outputs.some((line) => line.includes("Score: 1/3 (33%)"))).toBeTrue();
  });

  it("reprompts until answer is valid", async () => {
    const answers = ["z", "2"];
    const prompts: string[] = [];

    const result = await runStandaloneQuiz({
      documentContent: "alpha ".repeat(80),
      sourceLabel: "stdin",
      quizOption: { enabled: true },
      env: { OPENAI_API_KEY: "test" },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      generateQuiz: async () => ({
        questions: [
          {
            question: "Q1",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            topic: "Topic A",
          },
          {
            question: "Q2",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            topic: "Topic B",
          },
          {
            question: "Q3",
            options: ["A", "B", "C", "D"],
            correctIndex: 2,
            topic: "Topic C",
          },
        ],
      }),
      askAnswer: async (prompt) => {
        prompts.push(prompt);
        return answers.shift() ?? "2";
      },
      writeLine: () => {},
      createLoading: () => ({
        start: () => {},
        stop: () => {},
        succeed: () => {},
        fail: () => {},
      }),
    });

    expect(prompts.length).toBe(4);
    expect(result?.correctAnswers).toBe(1);
  });

  it("cleans up SIGINT listener when loading start throws", async () => {
    const before = process.listenerCount("SIGINT");

    await expect(
      runStandaloneQuiz({
        documentContent: "alpha ".repeat(140),
        sourceLabel: "stdin",
        quizOption: { enabled: true },
        env: { OPENAI_API_KEY: "test" },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        generateQuiz: async () => ({
          questions: [
            {
              question: "Q1",
              options: ["A", "B", "C", "D"],
              correctIndex: 0,
              topic: "Topic A",
            },
            {
              question: "Q2",
              options: ["A", "B", "C", "D"],
              correctIndex: 1,
              topic: "Topic B",
            },
            {
              question: "Q3",
              options: ["A", "B", "C", "D"],
              correctIndex: 2,
              topic: "Topic C",
            },
          ],
        }),
        askAnswer: async () => "1",
        writeLine: () => {},
        createLoading: (): LoadingIndicator => ({
          start: () => {
            throw new Error("loading start failed");
          },
          stop: () => {},
          succeed: () => {},
          fail: () => {},
        }),
      })
    ).rejects.toMatchObject({
      name: "QuizRuntimeError",
      stage: "runtime",
    } satisfies Partial<QuizRuntimeError>);

    expect(process.listenerCount("SIGINT")).toBe(before);
  });
});
