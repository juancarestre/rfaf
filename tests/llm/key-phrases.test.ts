import { describe, expect, it } from "bun:test";
import {
  buildKeyPhrasesPrompt,
  extractKeyPhrasesWithGenerator,
  KeyPhrasesResponseSchema,
  normalizeKeyPhrases,
} from "../../src/llm/key-phrases";

describe("key-phrases llm", () => {
  it("builds prompt with extraction and preservation guidance", () => {
    const prompt = buildKeyPhrasesPrompt("Alpha beta gamma", 8);

    expect(prompt).toContain("Extract key phrases");
    expect(prompt).toContain("Do not translate");
    expect(prompt).toContain("between 5 and 8 phrases");
  });

  it("validates structured response shape", () => {
    const parsed = KeyPhrasesResponseSchema.parse({
      phrases: ["speed reading", "reading rhythm"],
    });

    expect(parsed.phrases[0]).toBe("speed reading");
  });

  it("normalizes, dedupes, and caps phrases deterministically", () => {
    expect(
      normalizeKeyPhrases(
        [" speed reading ", "Speed Reading", "reading rhythm", "focus retention"],
        2
      )
    ).toEqual(["speed reading", "reading rhythm"]);
  });

  it("retries transient runtime failures", async () => {
    let attempts = 0;

    const phrases = await extractKeyPhrasesWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: "The article explains speed reading with pacing and punctuation handling.",
        maxPhrases: 8,
        timeoutMs: 1_000,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return {
          object: {
            phrases: ["speed reading", "pacing", "punctuation handling"],
          },
        };
      }
    );

    expect(attempts).toBe(2);
    expect(phrases).toContain("speed reading");
  });

  it("fails closed when provider returns schema-invalid key phrase payload", async () => {
    await expect(
      extractKeyPhrasesWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "Alpha beta gamma",
          maxPhrases: 8,
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => {
          throw new Error("schema mismatch");
        }
      )
    ).rejects.toThrow("[schema]");
  });

  it("classifies timeout failures deterministically", async () => {
    await expect(
      extractKeyPhrasesWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "Alpha beta gamma",
          maxPhrases: 8,
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

          return { object: { phrases: ["should not happen"] } };
        }
      )
    ).rejects.toThrow("[timeout]");
  });

  it("enforces one global timeout budget across retries", async () => {
    let calls = 0;

    await expect(
      extractKeyPhrasesWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "Alpha beta gamma",
          maxPhrases: 8,
          timeoutMs: 1,
          maxRetries: 2,
        },
        async ({ abortSignal }) => {
          calls += 1;
          await new Promise<void>((_, reject) => {
            abortSignal.addEventListener(
              "abort",
              () => {
                reject(new Error("timeout"));
              },
              { once: true }
            );
          });

          return { object: { phrases: ["should not happen"] } };
        }
      )
    ).rejects.toThrow("[timeout]");

    expect(calls).toBe(1);
  });

  it("fails closed when extracted phrases are not grounded in source text", async () => {
    await expect(
      extractKeyPhrasesWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "The source talks about speed reading and eye movement.",
          maxPhrases: 8,
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({ object: { phrases: ["quantum tunneling"] } })
      )
    ).rejects.toThrow("grounding check failed");
  });
});
