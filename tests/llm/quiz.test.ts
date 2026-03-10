import { describe, expect, it } from "bun:test";
import {
  buildQuizPrompt,
  deriveAdaptiveQuestionCount,
  generateQuizWithGenerator,
  normalizeQuizQuestions,
  QuizResponseSchema,
} from "../../src/llm/quiz";

function buildSource(wordCount: number): string {
  return new Array(wordCount).fill("alpha").join(" ");
}

function buildQuestions(count: number) {
  return new Array(count).fill(null).map((_, index) => ({
    question: `Question ${index + 1}`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: 0,
    topic: `Topic ${index + 1}`,
  }));
}

describe("quiz llm", () => {
  it("builds prompt with adaptive count and MCQ contract", () => {
    const prompt = buildQuizPrompt("Source text", 5);

    expect(prompt).toContain("Generate exactly 5 multiple-choice questions");
    expect(prompt).toContain("exactly 4 options");
    expect(prompt).toContain("Return JSON only");
  });

  it("validates structured quiz response shape", () => {
    const parsed = QuizResponseSchema.parse({
      questions: buildQuestions(3),
    });

    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0]?.question).toBe("Question 1");
  });

  it("uses adaptive question-count bounds", () => {
    expect(deriveAdaptiveQuestionCount(buildSource(20))).toBe(0);
    expect(deriveAdaptiveQuestionCount(buildSource(120))).toBe(3);
    expect(deriveAdaptiveQuestionCount(buildSource(600))).toBe(5);
    expect(deriveAdaptiveQuestionCount(buildSource(1_600))).toBe(7);
    expect(deriveAdaptiveQuestionCount(buildSource(3_600))).toBe(10);
  });

  it("normalizes quiz content by trimming fields", () => {
    const normalized = normalizeQuizQuestions([
      {
        question: "  Question 1  ",
        options: [" A ", " B ", " C ", " D "],
        correctIndex: 1,
        topic: "  Topic 1  ",
      },
    ]);

    expect(normalized[0]).toEqual({
      question: "Question 1",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      topic: "Topic 1",
    });
  });

  it("fails closed when source text is too short", async () => {
    await expect(
      generateQuizWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "too short",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({
          object: { questions: buildQuestions(3) },
        })
      )
    ).rejects.toThrow("insufficient source text");
  });

  it("fails closed when provider returns wrong question count", async () => {
    await expect(
      generateQuizWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: buildSource(120),
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({
          object: { questions: buildQuestions(2) },
        })
      )
    ).rejects.toThrow("question count check failed");
  });

  it("fails closed when options are duplicated", async () => {
    await expect(
      generateQuizWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: buildSource(120),
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            questions: [
              {
                question: "Question 1",
                options: ["A", "A", "C", "D"],
                correctIndex: 1,
                topic: "Topic 1",
              },
              ...buildQuestions(2),
            ],
          },
        })
      )
    ).rejects.toThrow("option uniqueness check failed");
  });

  it("retries transient runtime failures", async () => {
    let attempts = 0;

    const result = await generateQuizWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: buildSource(120),
        timeoutMs: 1_000,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return {
          object: { questions: buildQuestions(3) },
        };
      }
    );

    expect(attempts).toBe(2);
    expect(result.questions).toHaveLength(3);
  });

  it("cancels promptly when abort signal triggers during retry backoff", async () => {
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(new Error("cancelled")), 20);

    const startedAt = Date.now();

    await expect(
      generateQuizWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: buildSource(120),
          timeoutMs: 1_000,
          maxRetries: 3,
          signal: abortController.signal,
        },
        async () => {
          throw new Error("429 rate limit");
        }
      )
    ).rejects.toThrow("request cancelled");

    expect(Date.now() - startedAt).toBeLessThan(150);
  });

  it("classifies timeout failures deterministically", async () => {
    await expect(
      generateQuizWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: buildSource(120),
          timeoutMs: 5,
          maxRetries: 0,
        },
        async ({ abortSignal }) => {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, 30);
            abortSignal.addEventListener(
              "abort",
              () => {
                clearTimeout(timeout);
                reject(new Error("timeout"));
              },
              { once: true }
            );
          });

          return {
            object: {
              questions: buildQuestions(3),
            },
          };
        }
      )
    ).rejects.toThrow("[timeout]");
  });
});
