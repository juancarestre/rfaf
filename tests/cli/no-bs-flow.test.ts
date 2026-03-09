import { describe, expect, it } from "bun:test";
import { NoBsRuntimeError } from "../../src/cli/errors";
import { noBsBeforeRsvp } from "../../src/cli/no-bs-flow";

describe("noBsBeforeRsvp", () => {
  it("fails closed when deterministic cleanup removes all content", async () => {
    await expect(
      noBsBeforeRsvp({
        documentContent: "cookie policy\nsubscribe now\nHome | Pricing | Contact",
        sourceLabel: "stdin",
        noBsOption: { enabled: true },
        cleanText: () => "",
        runNoBs: async () => "",
      })
    ).rejects.toMatchObject({
      name: "NoBsRuntimeError",
      stage: "schema",
      message: "No-BS failed [schema]: no-bs produced empty text.",
    } satisfies Partial<NoBsRuntimeError>);
  });

  it("returns no-bs content and source label on success", async () => {
    const result = await noBsBeforeRsvp({
      documentContent: "Texto original",
      sourceLabel: "stdin",
      noBsOption: { enabled: true },
      cleanText: () => "Texto limpio",
      runNoBs: async () => "Texto limpio enfocado",
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1000,
        maxRetries: 0,
      }),
      env: {
        OPENAI_API_KEY: "test",
      },
    });

    expect(result.readingContent).toBe("Texto limpio enfocado");
    expect(result.sourceLabel).toBe("stdin (no-bs)");
  });

  it("cleans up SIGINT listener when loading start throws", async () => {
    const beforeListeners = process.listenerCount("SIGINT");

    await expect(
      noBsBeforeRsvp({
        documentContent: "Texto original",
        sourceLabel: "stdin",
        noBsOption: { enabled: true },
        cleanText: () => "Texto limpio",
        runNoBs: async () => "Texto limpio",
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-4o-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1000,
          maxRetries: 0,
        }),
        createLoading: () => ({
          start: () => {
            throw new Error("loading start failed");
          },
          stop: () => {},
          succeed: () => {},
          fail: () => {},
        }),
      })
    ).rejects.toThrow("No-BS failed [runtime]");

    expect(process.listenerCount("SIGINT")).toBe(beforeListeners);
  });
});
