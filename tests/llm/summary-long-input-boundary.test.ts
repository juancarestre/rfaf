import { describe, expect, it } from "bun:test";
import { summarizeTextWithGenerator } from "../../src/llm/summarize";
import { DEFAULT_LONG_INPUT_TRIGGER_BYTES } from "../../src/llm/long-input-chunking";

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function makeBytesAtLeast(size: number): string {
  const seed = "alpha beta gamma delta epsilon zeta eta theta iota kappa ";
  let value = "";
  while (byteLength(value) < size) {
    value += seed;
  }
  return value;
}

function summarizeWithinBounds(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const targetCount = Math.max(1, Math.ceil(words.length * 0.4));
  return words.slice(0, targetCount).join(" ");
}

function makeLongWordSequence(wordCount: number, wordLength = 60): string {
  return Array.from({ length: wordCount }, (_, index) => {
    const prefix = `w${index}`;
    const paddingLength = Math.max(1, wordLength - prefix.length);
    return `${prefix}${"x".repeat(paddingLength)}`;
  }).join(" ");
}

describe("summary long-input boundary", () => {
  it("uses single pass when input is below long-input threshold", async () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const source = makeBytesAtLeast(n - 1).slice(0, n - 1);
    let calls = 0;

    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "long",
        input: source,
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async ({ prompt }) => {
        calls += 1;
        const section = prompt.split("Text to summarize:\n\n")[1] ?? "";
        return { object: { summary: summarizeWithinBounds(section) } };
      }
    );

    expect(calls).toBe(1);
    expect(summary.length).toBeGreaterThan(0);
  });

  it("chunks deterministically when input is at or above long-input threshold", async () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const source = makeBytesAtLeast(n + 500);
    let calls = 0;

    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "long",
        input: source,
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async ({ prompt }) => {
        calls += 1;
        const section = prompt.split("Text to summarize:\n\n")[1] ?? "";
        return { object: { summary: summarizeWithinBounds(section) } };
      }
    );

    expect(calls).toBeGreaterThan(1);
    expect(summary.length).toBeGreaterThan(0);
  });

  it("validates length contract on merged output instead of each chunk", async () => {
    const source = makeLongWordSequence(200, 60);
    let calls = 0;

    const summary = await summarizeTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        preset: "long",
        input: source,
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async ({ prompt }) => {
        calls += 1;
        const section = prompt.split("Text to summarize:\n\n")[1] ?? "";
        return { object: { summary: summarizeWithinBounds(section) } };
      }
    );

    expect(calls).toBeGreaterThan(1);
    expect(summary.split(/\s+/).length).toBeGreaterThanOrEqual(76);
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(120);
  });

  it("enforces a global timeout budget across chunked calls", async () => {
    const source = makeLongWordSequence(200, 60);
    let calls = 0;
    let simulatedNow = 0;
    const originalNow = Date.now;
    Date.now = () => simulatedNow;

    try {
      await expect(
        summarizeTextWithGenerator(
          {
            provider: "openai",
            model: "gpt-5-mini",
            apiKey: "test",
            preset: "long",
            input: source,
            timeoutMs: 100,
            maxRetries: 0,
          },
          async ({ prompt }) => {
            calls += 1;
            const section = prompt.split("Text to summarize:\n\n")[1] ?? "";
            simulatedNow += 80;
            return { object: { summary: summarizeWithinBounds(section) } };
          }
        )
      ).rejects.toThrow("[timeout]");

      expect(calls).toBeGreaterThan(1);
    } finally {
      Date.now = originalNow;
    }
  });
});
