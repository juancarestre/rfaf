import { describe, expect, it } from "bun:test";
import {
  SummaryResponseSchema,
  buildSummaryPrompt,
  normalizeSummaryText,
  resolveSummaryLengthContract,
  summarizeTextWithGenerator,
} from "../../src/llm/summarize";

function makeWordSequence(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
}

describe("summarize helpers", () => {
  it("builds preset-specific prompt guidance", () => {
    const shortPrompt = buildSummaryPrompt("hello world", "short");
    const longPrompt = buildSummaryPrompt("hello world", "long");

    expect(shortPrompt).toContain("short");
    expect(longPrompt).toContain("long");
    expect(shortPrompt).toContain("Target");
    expect(shortPrompt).not.toBe(longPrompt);
  });

  it("uses near-original bounds for short inputs across all presets", () => {
    const shortBounds = resolveSummaryLengthContract(120, "short");
    const mediumBounds = resolveSummaryLengthContract(120, "medium");
    const longBounds = resolveSummaryLengthContract(120, "long");

    expect(shortBounds).toEqual({ minimumWords: 84, maximumWords: 120 });
    expect(mediumBounds).toEqual({ minimumWords: 84, maximumWords: 120 });
    expect(longBounds).toEqual({ minimumWords: 84, maximumWords: 120 });
  });

  it("keeps monotonic proportional bounds for long inputs", () => {
    const shortBounds = resolveSummaryLengthContract(200, "short");
    const mediumBounds = resolveSummaryLengthContract(200, "medium");
    const longBounds = resolveSummaryLengthContract(200, "long");

    expect(shortBounds.minimumWords).toBeLessThanOrEqual(mediumBounds.minimumWords);
    expect(mediumBounds.minimumWords).toBeLessThanOrEqual(longBounds.minimumWords);
    expect(shortBounds.maximumWords).toBeLessThanOrEqual(mediumBounds.maximumWords);
    expect(mediumBounds.maximumWords).toBeLessThanOrEqual(longBounds.maximumWords);
    expect(shortBounds).toEqual({ minimumWords: 24, maximumWords: 44 });
    expect(mediumBounds).toEqual({ minimumWords: 44, maximumWords: 76 });
    expect(longBounds).toEqual({ minimumWords: 76, maximumWords: 120 });
  });

  it("includes explicit language-preservation and no-translation contract", () => {
    const prompt = buildSummaryPrompt("Hola mundo", "medium");

    expect(prompt).toContain("same language as the input text");
    expect(prompt).toContain("Do not translate");
    expect(prompt).toContain("unless explicitly requested");
  });

  it("validates structured summary response shape", () => {
    const parsed = SummaryResponseSchema.parse({
      summary: "This is a concise summary.",
    });

    expect(parsed.summary).toContain("concise");
  });

  it("rejects empty summary text", () => {
    expect(() => SummaryResponseSchema.parse({ summary: "   " })).toThrow();
  });

  it("normalizes and trims summary content", () => {
    expect(normalizeSummaryText("  Line one\n\nLine two  ")).toBe(
      "Line one\n\nLine two"
    );
  });

  it("retries transient runtime errors up to maxRetries", async () => {
    let attempts = 0;

    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "medium",
        input: "hello world",
        timeoutMs: 500,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return { object: { summary: "Recovered summary" } };
      }
    );

    expect(attempts).toBe(2);
    expect(summary).toBe("Recovered summary");
  });

  it("throws timeout-classified errors when request exceeds timeout", async () => {
    try {
      await summarizeTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          preset: "medium",
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

          return { object: { summary: "should not happen" } };
        }
      );
      throw new Error("expected summarizeTextWithGenerator to throw");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("[timeout]");
    }
  });

  it("retries when non-English input receives English translated output", async () => {
    let attempts = 0;

    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "medium",
        input: "これは日本語の文章です。重要な内容を短くまとめてください。",
        timeoutMs: 500,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          return { object: { summary: "This is an English translation summary." } };
        }

        return { object: { summary: "これは日本語の要約です。" } };
      }
    );

    expect(attempts).toBe(2);
    expect(summary).toContain("日本語");
  });

  it("accepts same-language output for non-English input", async () => {
    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "short",
        input: "これは日本語の文章です。",
        timeoutMs: 500,
        maxRetries: 1,
      },
      async () => ({ object: { summary: "これは日本語の要約です。" } })
    );

    expect(summary).toContain("日本語");
  });

  it("accepts English output for English input", async () => {
    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "short",
        input: "This is an English source paragraph about architecture and testing.",
        timeoutMs: 500,
        maxRetries: 1,
      },
      async () => ({
        object: { summary: "This is an English summary about architecture and testing." },
      })
    );

    expect(summary).toBe("This is an English summary about architecture and testing.");
  });

  it("fails deterministically after retry exhaustion on repeated language mismatch", async () => {
    let attempts = 0;

    await expect(
      summarizeTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          preset: "medium",
          input: "これは日本語の文章です。重要な内容を短くまとめてください。",
          timeoutMs: 500,
          maxRetries: 1,
        },
        async () => {
          attempts += 1;
          return { object: { summary: "This is an English translation summary." } };
        }
      )
    ).rejects.toThrow("language preservation check failed");

    expect(attempts).toBe(2);
  });

  it("fails closed when summary output violates proportional bounds", async () => {
    await expect(
      summarizeTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          preset: "short",
          input: makeWordSequence(200),
          timeoutMs: 500,
          maxRetries: 0,
        },
        async () => ({ object: { summary: makeWordSequence(10) } })
      )
    ).rejects.toThrow("summary length check failed");
  });

  it("accepts output inside proportional bounds for long-input short preset", async () => {
    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "short",
        input: makeWordSequence(200),
        timeoutMs: 500,
        maxRetries: 0,
      },
      async () => ({ object: { summary: makeWordSequence(30) } })
    );

    expect(summary.split(/\s+/).length).toBe(30);
  });

  it("accepts near-original short-input output", async () => {
    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "long",
        input: makeWordSequence(100),
        timeoutMs: 500,
        maxRetries: 0,
      },
      async () => ({ object: { summary: makeWordSequence(80) } })
    );

    expect(summary.split(/\s+/).length).toBe(80);
  });
});
