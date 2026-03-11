import { describe, expect, it } from "bun:test";
import { TranslateRuntimeError, UsageError } from "../../src/cli/errors";
import { translateBeforeRsvp } from "../../src/cli/translate-flow";
import { LanguageNormalizationError } from "../../src/llm/language-normalizer";

describe("translateBeforeRsvp", () => {
  it("bypasses translation when option is disabled", async () => {
    const result = await translateBeforeRsvp({
      documentContent: "original text",
      sourceLabel: "stdin",
      translateOption: { enabled: false, target: null },
    });

    expect(result.readingContent).toBe("original text");
    expect(result.sourceLabel).toBe("stdin");
  });

  it("normalizes target then translates content", async () => {
    const calls: string[] = [];

    const result = await translateBeforeRsvp({
      documentContent: "This is source text.",
      sourceLabel: "stdin",
      translateOption: { enabled: true, target: "english" },
      env: {
        OPENAI_API_KEY: "test",
      },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      normalizeTarget: async ({ target }) => {
        calls.push(`normalize:${target}`);
        return "es";
      },
      translate: async ({ targetLanguage }) => {
        calls.push(`translate:${targetLanguage}`);
        return "Este es texto fuente.";
      },
    });

    expect(calls).toEqual(["normalize:english", "translate:es"]);
    expect(result.readingContent).toBe("Este es texto fuente.");
    expect(result.sourceLabel).toBe("stdin (translated:es)");
  });

  it("maps unresolved target normalization failures to usage errors", async () => {
    await expect(
      translateBeforeRsvp({
        documentContent: "This is source text.",
        sourceLabel: "stdin",
        translateOption: { enabled: true, target: "zzzzzz" },
        env: {
          OPENAI_API_KEY: "test",
        },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        normalizeTarget: async () => {
          throw new LanguageNormalizationError(
            "TARGET_UNRESOLVED",
            "Unresolved --translate-to target. Use a different language value."
          );
        },
      })
    ).rejects.toMatchObject({
      name: "UsageError",
      message: "Unresolved --translate-to target. Use a different language value.",
    } satisfies Partial<UsageError>);
  });

  it("fails closed when translation runtime errors", async () => {
    await expect(
      translateBeforeRsvp({
        documentContent: "This is source text.",
        sourceLabel: "stdin",
        translateOption: { enabled: true, target: "es" },
        env: {
          OPENAI_API_KEY: "test",
        },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        normalizeTarget: async () => "es",
        translate: async () => {
          throw new TranslateRuntimeError("Translation failed [network]: unable to reach provider.", "network");
        },
      })
    ).rejects.toMatchObject({
      name: "TranslateRuntimeError",
      stage: "network",
    } satisfies Partial<TranslateRuntimeError>);
  });

  it("translates long content in chunks instead of one oversized call", async () => {
    const calls: string[] = [];
    const longText = `${"alpha beta gamma delta epsilon ".repeat(3500)}\n\n${
      "zeta eta theta iota kappa ".repeat(3500)
    }`;

    const result = await translateBeforeRsvp({
      documentContent: longText,
      sourceLabel: "stdin",
      translateOption: { enabled: true, target: "es" },
      env: {
        OPENAI_API_KEY: "test",
      },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      normalizeTarget: async () => "es",
      translate: async ({ input }) => {
        calls.push(input);
        return `tr:${input.slice(0, 12)}`;
      },
    });

    expect(calls.length).toBeGreaterThan(1);
    expect(result.readingContent.split("\n\n").length).toBe(calls.length);
    expect(result.sourceLabel).toBe("stdin (translated:es)");
  });

  it("shares one timeout deadline across translated chunks", async () => {
    const deadlines = new Set<number>();
    const longText = `${"alpha beta gamma delta epsilon ".repeat(3500)}\n\n${
      "zeta eta theta iota kappa ".repeat(3500)
    }`;

    await translateBeforeRsvp({
      documentContent: longText,
      sourceLabel: "stdin",
      translateOption: { enabled: true, target: "es" },
      env: {
        OPENAI_API_KEY: "test",
      },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      normalizeTarget: async () => "es",
      translate: async ({ timeoutDeadlineMs, input }) => {
        if (typeof timeoutDeadlineMs === "number") {
          deadlines.add(timeoutDeadlineMs);
        }
        return `tr:${input.slice(0, 12)}`;
      },
    });

    expect(deadlines.size).toBe(1);
  });

  it("continues without translation when timeout recovery outcome is continue", async () => {
    const warnings: string[] = [];

    const result = await translateBeforeRsvp({
      documentContent: "This is source text.",
      sourceLabel: "stdin",
      translateOption: { enabled: true, target: "es" },
      env: {
        OPENAI_API_KEY: "test",
      },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      normalizeTarget: async () => "es",
      translate: async () => {
        throw new TranslateRuntimeError("Translation failed [timeout]: request timed out.", "timeout");
      },
      resolveTimeoutOutcome: async () => "continue",
      writeWarning: (line) => warnings.push(line),
    });

    expect(result.readingContent).toBe("This is source text.");
    expect(result.sourceLabel).toBe("stdin");
    expect(warnings).toContain("[warn] translation timed out; continuing without translation transform");
  });
});
