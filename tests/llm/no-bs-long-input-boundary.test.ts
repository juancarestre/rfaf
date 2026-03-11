import { describe, expect, it } from "bun:test";
import { noBsTextWithGenerator } from "../../src/llm/no-bs";
import { DEFAULT_LONG_INPUT_TRIGGER_BYTES } from "../../src/llm/long-input-chunking";

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function makeBytesAtLeast(size: number): string {
  const seed = "Black Sabbath was formed in Birmingham in 1968 by Tony Iommi and Geezer Butler. ";
  let value = "";
  while (byteLength(value) < size) {
    value += seed;
  }
  return value;
}

function extractSource(prompt: string): string {
  const open = "<source_text>\n\n";
  const close = "\n\n</source_text>";
  const start = prompt.indexOf(open);
  const end = prompt.lastIndexOf(close);
  if (start < 0 || end < 0 || end <= start) {
    return "";
  }

  return prompt.slice(start + open.length, end);
}

describe("no-bs long-input boundary", () => {
  it("uses single pass when input is below long-input threshold", async () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const source = makeBytesAtLeast(n - 1).slice(0, n - 1);
    let calls = 0;

    const cleaned = await noBsTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: source,
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async ({ prompt }) => {
        calls += 1;
        return { object: { cleaned_text: extractSource(prompt) } };
      }
    );

    expect(calls).toBe(1);
    expect(cleaned.length).toBeGreaterThan(0);
  });

  it("chunks deterministically when input is at or above long-input threshold", async () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const source = makeBytesAtLeast(n + 500);
    let calls = 0;

    const cleaned = await noBsTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: source,
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async ({ prompt }) => {
        calls += 1;
        return { object: { cleaned_text: extractSource(prompt) } };
      }
    );

    expect(calls).toBeGreaterThan(1);
    expect(cleaned.length).toBeGreaterThan(0);
  });

  it("enforces a global timeout budget across chunked calls", async () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const source = makeBytesAtLeast(n + 500);
    let calls = 0;
    let simulatedNow = 0;
    const originalNow = Date.now;
    Date.now = () => simulatedNow;

    try {
      await expect(
        noBsTextWithGenerator(
          {
            provider: "openai",
            model: "gpt-4o-mini",
            apiKey: "test",
            input: source,
            timeoutMs: 30,
            maxRetries: 0,
          },
          async ({ prompt }) => {
            calls += 1;
            simulatedNow += 40;
            return { object: { cleaned_text: extractSource(prompt) } };
          }
        )
      ).rejects.toThrow("[timeout]");

      expect(calls).toBeGreaterThan(1);
    } finally {
      Date.now = originalNow;
    }
  });
});
