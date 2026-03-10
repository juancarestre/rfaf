import { describe, expect, it } from "bun:test";
import {
  buildStrategyPrompt,
  normalizeStrategyRationale,
  recommendStrategyWithGenerator,
  StrategyResponseSchema,
} from "../../src/llm/strategy";

describe("strategy llm", () => {
  it("builds prompt with strict mode domain", () => {
    const prompt = buildStrategyPrompt("hello world");

    expect(prompt).toContain("rsvp");
    expect(prompt).toContain("chunked");
    expect(prompt).toContain("bionic");
    expect(prompt).toContain("scroll");
    expect(prompt).toContain("exactly one mode");
  });

  it("validates structured strategy response shape", () => {
    const parsed = StrategyResponseSchema.parse({
      mode: "chunked",
      rationale: "Long clauses read better in phrase groups.",
    });

    expect(parsed.mode).toBe("chunked");
  });

  it("normalizes rationale to one line", () => {
    expect(normalizeStrategyRationale("  one\n\n two\tthree  ")).toBe("one two three");
  });

  it("retries transient runtime errors up to maxRetries", async () => {
    let attempts = 0;

    const recommendation = await recommendStrategyWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        input: "hello world",
        timeoutMs: 500,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return {
          object: {
            mode: "rsvp",
            rationale: "Focused word-by-word pacing fits this text.",
          },
        };
      }
    );

    expect(attempts).toBe(2);
    expect(recommendation.mode).toBe("rsvp");
  });

  it("throws timeout-classified errors when request exceeds timeout", async () => {
    try {
      await recommendStrategyWithGenerator(
        {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          input: "hello world",
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
              mode: "rsvp",
              rationale: "should not happen",
            },
          };
        }
      );
      throw new Error("expected recommendStrategyWithGenerator to throw");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("[timeout]");
    }
  });

  it("fails deterministically when rationale is empty after normalization", async () => {
    await expect(
      recommendStrategyWithGenerator(
        {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          input: "hello world",
          timeoutMs: 500,
          maxRetries: 0,
        },
        async () => ({
          object: {
            mode: "scroll",
            rationale: "   \n  ",
          },
        })
      )
    ).rejects.toThrow("[schema]");
  });
});
