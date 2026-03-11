import { describe, expect, it } from "bun:test";
import { SummarizeRuntimeError } from "../../src/cli/errors";
import type { LoadingIndicator } from "../../src/cli/loading-indicator";
import { summarizeBeforeRsvp } from "../../src/cli/summarize-flow";

describe("summarizeBeforeRsvp", () => {
  it("bypasses summarize pipeline when summary mode is disabled", async () => {
    const result = await summarizeBeforeRsvp({
      documentContent: "original",
      sourceLabel: "stdin",
      summaryOption: { enabled: false, preset: null },
    });

    expect(result.readingContent).toBe("original");
    expect(result.sourceLabel).toBe("stdin");
  });

  it("uses summarized text as the RSVP reading source", async () => {
    const calls: Array<"start" | "stop" | "succeed" | "fail"> = [];
    const mockLoading: LoadingIndicator = {
      start: () => calls.push("start"),
      stop: () => calls.push("stop"),
      succeed: () => calls.push("succeed"),
      fail: () => calls.push("fail"),
    };

    const result = await summarizeBeforeRsvp({
      documentContent: "original content",
      sourceLabel: "file",
      summaryOption: { enabled: true, preset: "short" },
      env: { OPENAI_API_KEY: "test" },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      summarize: async () => "summarized output",
      createLoading: () => mockLoading,
    });

    expect(result.readingContent).toBe("summarized output");
    expect(result.sourceLabel).toContain("summary:short");
    expect(calls).toEqual(["start", "stop", "succeed"]);
  });

  it("does not return original content when summarization fails", async () => {
    const calls: Array<"start" | "stop" | "succeed" | "fail"> = [];

    try {
      await summarizeBeforeRsvp({
        documentContent: "original",
        sourceLabel: "stdin",
        summaryOption: { enabled: true, preset: "medium" },
        env: { OPENAI_API_KEY: "test" },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        summarize: async () => {
          throw new Error("network down");
        },
        createLoading: () => ({
          start: () => calls.push("start"),
          stop: () => calls.push("stop"),
          succeed: () => calls.push("succeed"),
          fail: () => calls.push("fail"),
        }),
      });
      throw new Error("expected summarizeBeforeRsvp to throw");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Summarization failed");
    }

    expect(calls).toEqual(["start", "stop", "fail"]);
  });

  it("cancels summarize flow on SIGINT and stops loading", async () => {
    const calls: Array<"start" | "stop" | "succeed" | "fail"> = [];

    try {
      await summarizeBeforeRsvp({
        documentContent: "original",
        sourceLabel: "stdin",
        summaryOption: { enabled: true, preset: "medium" },
        env: { OPENAI_API_KEY: "test" },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        summarize: async ({ signal }) => {
          await new Promise<void>((resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("cancelled"));
              },
              { once: true }
            );

            setTimeout(() => {
              process.emit("SIGINT", "SIGINT");
            }, 0);
          });

          return "should-not-complete";
        },
        createLoading: () => ({
          start: () => calls.push("start"),
          stop: () => calls.push("stop"),
          succeed: () => calls.push("succeed"),
          fail: () => calls.push("fail"),
        }),
      });

      throw new Error("expected SIGINT cancellation to throw");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Summarization failed");
    }

    expect(calls).toEqual(["start", "stop", "fail"]);
  });

  it("continues without summary when timeout recovery outcome is continue", async () => {
    const warnings: string[] = [];

    const result = await summarizeBeforeRsvp({
      documentContent: "original",
      sourceLabel: "stdin",
      summaryOption: { enabled: true, preset: "medium" },
      env: { OPENAI_API_KEY: "test" },
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 1_000,
        maxRetries: 0,
      }),
      summarize: async () => {
        throw new SummarizeRuntimeError(
          "Summarization failed [timeout]: request timed out.",
          "timeout"
        );
      },
      resolveTimeoutOutcome: async () => "continue",
      writeWarning: (line) => warnings.push(line),
    });

    expect(result.readingContent).toBe("original");
    expect(result.sourceLabel).toBe("stdin");
    expect(warnings).toContain("[warn] summary timed out; continuing without summary transform");
  });

  it("aborts when timeout recovery outcome is abort", async () => {
    await expect(
      summarizeBeforeRsvp({
        documentContent: "original",
        sourceLabel: "stdin",
        summaryOption: { enabled: true, preset: "medium" },
        env: { OPENAI_API_KEY: "test" },
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 1_000,
          maxRetries: 0,
        }),
        summarize: async () => {
          throw new SummarizeRuntimeError(
            "Summarization failed [timeout]: request timed out.",
            "timeout"
          );
        },
        resolveTimeoutOutcome: async () => "abort",
      })
    ).rejects.toThrow("Summarization failed [timeout]");
  });
});
