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
});
