import { describe, expect, it } from "bun:test";
import * as readerApi from "../../src/agent/reader-api";

describe("agent strategy parity", () => {
  it("exposes dedicated strategy command", () => {
    expect(typeof readerApi.executeAgentStrategyCommand).toBe("function");
  });

  it("applies recommended mode when explicit mode is not provided", async () => {
    const runtime = readerApi.createAgentReaderRuntime(
      [
        {
          text: "alpha",
          index: 0,
          paragraphIndex: 0,
          isParagraphStart: true,
          trailingPunctuation: null,
        },
      ],
      300
    );

    const result = await readerApi.executeAgentStrategyCommand(
      runtime,
      {
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => ({
        mode: "chunked",
        rationale: "Phrase grouping improves this text flow.",
      })
    );

    expect(result.recommendedMode).toBe("chunked");
    expect(result.appliedMode).toBe("chunked");
    expect(result.warning).toBeNull();
    expect(result.runtime.readingMode).toBe("chunked");
  });

  it("keeps explicit selected mode and returns would-have-picked recommendation", async () => {
    const runtime = readerApi.createAgentReaderRuntime(
      [
        {
          text: "alpha",
          index: 0,
          paragraphIndex: 0,
          isParagraphStart: true,
          trailingPunctuation: null,
        },
      ],
      300,
      "normal",
      "scroll"
    );

    const result = await readerApi.executeAgentStrategyCommand(
      runtime,
      {
        selectedMode: "scroll",
        explicitModeProvided: true,
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => ({
        mode: "chunked",
        rationale: "Phrase grouping improves this text flow.",
      })
    );

    expect(result.recommendedMode).toBe("chunked");
    expect(result.appliedMode).toBe("scroll");
    expect(result.runtime.readingMode).toBe("scroll");
  });

  it("returns warning without mutating runtime on strategy runtime failure", async () => {
    const runtime = readerApi.createAgentReaderRuntime(
      [
        {
          text: "alpha",
          index: 0,
          paragraphIndex: 0,
          isParagraphStart: true,
          trailingPunctuation: null,
        },
      ],
      300
    );

    const result = await readerApi.executeAgentStrategyCommand(
      runtime,
      {
        llmConfig: {
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          timeoutMs: 1_000,
          maxRetries: 0,
        },
      },
      async () => {
        throw new Error("network timeout");
      }
    );

    expect(result.recommendedMode).toBeNull();
    expect(result.rationale).toBeNull();
    expect(result.warning).toContain("Strategy unavailable");
    expect(result.runtime).toBe(runtime);
  });
});
