import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNoBsPrompt,
  NoBsResponseSchema,
  noBsTextWithGenerator,
  normalizeNoBsText,
} from "../../src/llm/no-bs";

function readFixture(name: string): string {
  return readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
}

function firstWords(text: string, count: number): string {
  return text.trim().split(/\s+/).slice(0, count).join(" ");
}

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

  it("fails deterministically when English input is translated to Spanish", async () => {
    await expect(
      noBsTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input:
            "Black Sabbath was an English rock band formed in Birmingham in 1968 by guitarist Tony Iommi and bassist Geezer Butler.",
          timeoutMs: 1000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            cleaned_text:
              "Black Sabbath fue una banda de rock inglesa formada en Birmingham en 1968 por el guitarrista Tony Iommi y el bajista Geezer Butler.",
          },
        })
      )
    ).rejects.toThrow("language preservation check failed");
  });

  it("fails deterministically when Spanish input is translated to English", async () => {
    await expect(
      noBsTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input:
            "Black Sabbath fue una banda de rock inglesa formada en Birmingham en 1968 por el guitarrista Tony Iommi y el bajista Geezer Butler.",
          timeoutMs: 1000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            cleaned_text:
              "Black Sabbath was an English rock band formed in Birmingham in 1968 by guitarist Tony Iommi and bassist Geezer Butler.",
          },
        })
      )
    ).rejects.toThrow("language preservation check failed");
  });

  it("fails deterministically when cleaned output is summarized/truncated", async () => {
    const source =
      "Black Sabbath was an English rock band formed in Birmingham in 1968 by guitarist Tony Iommi and bassist Geezer Butler. ".repeat(
        180
      );

    await expect(
      noBsTextWithGenerator(
        {
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          input: source,
          timeoutMs: 1000,
          maxRetries: 0,
        },
        async () => ({
          object: {
            cleaned_text: firstWords(source, 18),
          },
        })
      )
    ).rejects.toThrow("content preservation check failed");
  });

  it("fails deterministically on large-fixture truncation (plaintext, structured, pdf-derived)", async () => {
    const fixtures = [
      "no-bs-large-plaintext.txt",
      "no-bs-large-structured.md",
      "no-bs-large-pdf-derived.txt",
    ] as const;

    for (const fixture of fixtures) {
      const source = readFixture(fixture);

      await expect(
        noBsTextWithGenerator(
          {
            provider: "openai",
            model: "gpt-4o-mini",
            apiKey: "test",
            input: source,
            timeoutMs: 1000,
            maxRetries: 0,
          },
          async () => ({
            object: {
              cleaned_text: firstWords(source, 24),
            },
          })
        )
      ).rejects.toThrow("content preservation check failed");
    }
  });
});
