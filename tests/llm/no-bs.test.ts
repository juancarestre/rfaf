import { describe, expect, it } from "bun:test";
import {
  buildNoBsPrompt,
  NoBsResponseSchema,
  noBsTextWithGenerator,
  normalizeNoBsText,
} from "../../src/llm/no-bs";

describe("no-bs llm", () => {
  it("builds prompt with same-language and no-new-facts contract", () => {
    const prompt = buildNoBsPrompt("Texto de origen");

    expect(prompt).toContain("same language");
    expect(prompt).toContain("Do not translate");
    expect(prompt).toContain("Do not add new facts");
  });

  it("validates structured no-bs response shape", () => {
    const parsed = NoBsResponseSchema.parse({
      cleaned_text: "Texto limpio",
    });

    expect(parsed.cleaned_text).toBe("Texto limpio");
  });

  it("normalizes cleaned output", () => {
    expect(normalizeNoBsText("\n Texto limpio \n")).toBe("Texto limpio");
  });

  it("fails deterministically on language mismatch without retrying contract violations", async () => {
    let attempts = 0;

    await expect(
      noBsTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "これは日本語の文章です。",
          timeoutMs: 1000,
          maxRetries: 3,
        },
        async () => {
          attempts += 1;
          return {
            object: {
              cleaned_text:
                "This is an English cleaned text that changes the language of the original source.",
            },
          };
        }
      )
    ).rejects.toThrow("language preservation check failed");

    expect(attempts).toBe(1);
  });

  it("accepts same-language output", async () => {
    const cleaned = await noBsTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: "これは日本語の文章です。",
        timeoutMs: 1000,
        maxRetries: 1,
      },
      async () => ({ object: { cleaned_text: "これは日本語の要約です。" } })
    );

    expect(cleaned).toContain("日本語");
  });

  it("retries transient runtime failures", async () => {
    let attempts = 0;

    const cleaned = await noBsTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        input: "Texto original sobre arquitectura y pruebas.",
        timeoutMs: 1000,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return { object: { cleaned_text: "Texto limpio sobre arquitectura y pruebas." } };
      }
    );

    expect(attempts).toBe(2);
    expect(cleaned).toContain("Texto limpio");
  });

  it("fails deterministically when no-new-facts check keeps failing", async () => {
    await expect(
      noBsTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: "El articulo habla de pruebas y arquitectura de sistemas.",
          timeoutMs: 1000,
          maxRetries: 1,
        },
        async () => ({
          object: { cleaned_text: "Este texto afirma 99 incidentes y una demanda legal." },
        })
      )
    ).rejects.toThrow("fact preservation check failed");
  });
});
