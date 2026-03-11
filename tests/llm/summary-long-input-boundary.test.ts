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
});
