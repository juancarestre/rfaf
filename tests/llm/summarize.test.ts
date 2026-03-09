import { describe, expect, it } from "bun:test";
import {
  SummaryResponseSchema,
  buildSummaryPrompt,
  normalizeSummaryText,
  summarizeTextWithGenerator,
} from "../../src/llm/summarize";

describe("summarize helpers", () => {
  it("builds preset-specific prompt guidance", () => {
    const shortPrompt = buildSummaryPrompt("hello world", "short");
    const longPrompt = buildSummaryPrompt("hello world", "long");

    expect(shortPrompt).toContain("short");
    expect(longPrompt).toContain("long");
    expect(shortPrompt).not.toBe(longPrompt);
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
      async () => ({ object: { summary: "This is an English summary." } })
    );

    expect(summary).toBe("This is an English summary.");
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
});
