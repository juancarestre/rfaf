import { describe, expect, it } from "bun:test";
import { KeyPhrasesRuntimeError } from "../../src/cli/errors";
import { keyPhrasesBeforeRsvp } from "../../src/cli/key-phrases-flow";

describe("keyPhrasesBeforeRsvp", () => {
  it("bypasses extraction when option is disabled", async () => {
    const result = await keyPhrasesBeforeRsvp({
      documentContent: "original text",
      sourceLabel: "stdin",
      keyPhrasesOption: { enabled: false, mode: null, maxPhrases: null },
    });

    expect(result.readingContent).toBe("original text");
    expect(result.sourceLabel).toBe("stdin");
    expect(result.keyPhrases).toEqual([]);
  });

  it("returns extracted phrases while preserving reading content", async () => {
    const result = await keyPhrasesBeforeRsvp({
      documentContent: "Texto original con ideas clave y ritmo lector.",
      sourceLabel: "stdin",
      keyPhrasesOption: { enabled: true, mode: "preview", maxPhrases: 8 },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      runExtract: async () => ["ideas clave", "ritmo lector"],
    });

    expect(result.readingContent).toBe("Texto original con ideas clave y ritmo lector.");
    expect(result.sourceLabel).toBe("stdin (key-phrases)");
    expect(result.keyPhrases).toEqual(["ideas clave", "ritmo lector"]);
  });

  it("fails closed for empty extracted key phrases", async () => {
    await expect(
      keyPhrasesBeforeRsvp({
        documentContent: "Alpha beta gamma",
        sourceLabel: "stdin",
        keyPhrasesOption: { enabled: true, mode: "preview", maxPhrases: 8 },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        runExtract: async () => [],
      })
    ).rejects.toMatchObject({
      name: "KeyPhrasesRuntimeError",
      stage: "schema",
    } satisfies Partial<KeyPhrasesRuntimeError>);
  });

  it("fails closed on runtime extraction errors", async () => {
    await expect(
      keyPhrasesBeforeRsvp({
        documentContent: "Alpha beta gamma",
        sourceLabel: "stdin",
        keyPhrasesOption: { enabled: true, mode: "preview", maxPhrases: 8 },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        runExtract: async () => {
          throw new KeyPhrasesRuntimeError(
            "Key-phrases failed [network]: unable to reach provider.",
            "network"
          );
        },
      })
    ).rejects.toMatchObject({
      name: "KeyPhrasesRuntimeError",
      stage: "network",
    } satisfies Partial<KeyPhrasesRuntimeError>);
  });

  it("continues without key-phrases when timeout recovery outcome is continue", async () => {
    const warnings: string[] = [];

    const result = await keyPhrasesBeforeRsvp({
      documentContent: "Alpha beta gamma",
      sourceLabel: "stdin",
      keyPhrasesOption: { enabled: true, mode: "preview", maxPhrases: 8 },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      runExtract: async () => {
        throw new KeyPhrasesRuntimeError(
          "Key-phrases failed [timeout]: request timed out.",
          "timeout"
        );
      },
      resolveTimeoutOutcome: async () => "continue",
      writeWarning: (line) => warnings.push(line),
    });

    expect(result.readingContent).toBe("Alpha beta gamma");
    expect(result.sourceLabel).toBe("stdin");
    expect(result.keyPhrases).toEqual([]);
    expect(warnings).toContain(
      "[warn] key-phrases timed out; continuing without key-phrases transform"
    );
  });
});
