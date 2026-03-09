import { describe, expect, it } from "bun:test";
import {
  LanguageNormalizationError,
  normalizeTargetLanguageWithGenerator,
} from "../../src/llm/language-normalizer";

const BASE_INPUT = {
  target: "",
  provider: "openai" as const,
  model: "gpt-4o-mini",
  apiKey: "test",
  timeoutMs: 1_000,
  maxRetries: 0,
};

describe("language normalizer", () => {
  it("normalizes direct language codes", async () => {
    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "es",
        },
        async () => ({ object: { tag: "fr", ambiguous: false } })
      )
    ).resolves.toBe("es");

    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "pt-br",
        },
        async () => ({ object: { tag: "fr", ambiguous: false } })
      )
    ).resolves.toBe("pt-BR");
  });

  it("normalizes known language names and variants", async () => {
    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "English",
        },
        async () => ({ object: { tag: "fr", ambiguous: false } })
      )
    ).resolves.toBe("en");

    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "ingles",
        },
        async () => ({ object: { tag: "fr", ambiguous: false } })
      )
    ).resolves.toBe("en");
  });

  it("fails deterministically for ambiguous local targets", async () => {
    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "chinese",
        },
        async () => ({ object: { tag: "zh", ambiguous: false } })
      )
    ).rejects.toMatchObject({
      name: "LanguageNormalizationError",
      code: "TARGET_AMBIGUOUS",
    } satisfies Partial<LanguageNormalizationError>);
  });

  it("fails deterministically for unresolved simple targets", async () => {
    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "zzzzzz",
        },
        async () => ({ object: { tag: "fr", ambiguous: false } })
      )
    ).rejects.toMatchObject({
      name: "LanguageNormalizationError",
      code: "TARGET_UNRESOLVED",
    } satisfies Partial<LanguageNormalizationError>);
  });

  it("uses generator fallback for fuzzy targets", async () => {
    let calls = 0;

    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "castellano de argentina",
        },
        async () => {
          calls += 1;
          return { object: { tag: "es-AR", ambiguous: false } };
        }
      )
    ).resolves.toBe("es-AR");

    expect(calls).toBe(1);
  });

  it("fails closed for path-like targets before any LLM call", async () => {
    let calls = 0;

    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "tests/fixtures/sample.txt",
        },
        async () => {
          calls += 1;
          return { object: { tag: "es", ambiguous: false } };
        }
      )
    ).rejects.toMatchObject({
      name: "LanguageNormalizationError",
      code: "TARGET_INVALID",
    } satisfies Partial<LanguageNormalizationError>);

    expect(calls).toBe(0);
  });

  it("retries transient normalizer provider failures", async () => {
    let attempts = 0;

    await expect(
      normalizeTargetLanguageWithGenerator(
        {
          ...BASE_INPUT,
          target: "castellano de argentina",
          maxRetries: 1,
        },
        async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("429 rate limit");
          }

          return { object: { tag: "es-AR", ambiguous: false } };
        }
      )
    ).resolves.toBe("es-AR");

    expect(attempts).toBe(2);
  });
});
