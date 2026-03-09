import { describe, expect, it } from "bun:test";
import {
  buildTranslatePrompt,
  normalizeTranslatedText,
  TranslateResponseSchema,
  translateTextWithGenerator,
} from "../../src/llm/translate";

describe("translate llm", () => {
  it("builds prompt with target language guidance", () => {
    const prompt = buildTranslatePrompt("Hola mundo", "en");

    expect(prompt).toContain("Translate into target language: en");
    expect(prompt).toContain("Do not add new facts");
    expect(prompt).toContain("Return plain text only");
  });

  it("validates structured translation output", () => {
    const parsed = TranslateResponseSchema.parse({
      translated_text: "Hello world",
    });

    expect(parsed.translated_text).toBe("Hello world");
  });

  it("normalizes translated output", () => {
    expect(normalizeTranslatedText("\n Hello world \n")).toBe("Hello world");
  });

  it("skips translation when source already matches target", async () => {
    let calls = 0;

    const result = await translateTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        targetLanguage: "en",
        input: "This is the original English text with several marker words and structure.",
        timeoutMs: 1_000,
        maxRetries: 1,
      },
      async () => {
        calls += 1;
        return { object: { translated_text: "should not run" } };
      }
    );

    expect(result).toContain("original English text");
    expect(calls).toBe(0);
  });

  it("retries transient provider failures", async () => {
    let attempts = 0;

    const translated = await translateTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        targetLanguage: "es",
        input: "This source text should be translated to Spanish.",
        timeoutMs: 1_000,
        maxRetries: 1,
      },
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("429 rate limit");
        }

        return { object: { translated_text: "Este texto fuente debe traducirse al espanol." } };
      }
    );

    expect(attempts).toBe(2);
    expect(translated).toContain("texto fuente");
  });

  it("does not mis-detect English text with occasional spanish tokens as already spanish", async () => {
    let calls = 0;

    const translated = await translateTextWithGenerator(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        targetLanguage: "es",
        input:
          "The band later played multiple Los Angeles dates, and those Los Angeles shows expanded their audience.",
        timeoutMs: 1_000,
        maxRetries: 0,
      },
      async () => {
        calls += 1;
        return {
          object: {
            translated_text:
              "La banda luego toco varias fechas en Los Angeles, y esos conciertos ampliaron su audiencia.",
          },
        };
      }
    );

    expect(calls).toBe(1);
    expect(translated).toContain("La banda");
  });

  it("fails closed when non-English target returns English output", async () => {
    await expect(
      translateTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          targetLanguage: "es",
          input: "This source text should be translated to Spanish language output.",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            translated_text: "This source text stays in English and violates target-language contract.",
          },
        })
      )
    ).rejects.toThrow("target language check failed");
  });

  it("fails closed when translation appears summarized/truncated", async () => {
    const source =
      "This is a long source paragraph about music history and chronology. ".repeat(180);

    await expect(
      translateTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          targetLanguage: "es",
          input: source,
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            translated_text: "Resumen breve en espanol del texto completo.",
          },
        })
      )
    ).rejects.toThrow("content preservation check failed");
  });

  it("classifies timeout failures deterministically", async () => {
    await expect(
      translateTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          targetLanguage: "es",
          input: "Translate this text.",
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

          return { object: { translated_text: "should not happen" } };
        }
      )
    ).rejects.toThrow("[timeout]");
  });

  it("classifies SIGINT/cancel failures deterministically", async () => {
    await expect(
      translateTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          targetLanguage: "es",
          input: "Translate this text.",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
        async () => {
          throw new Error("SIGINT");
        }
      )
    ).rejects.toThrow("request cancelled");
  });
});
