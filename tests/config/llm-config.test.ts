import { describe, expect, it } from "bun:test";
import {
  DEFAULT_SUMMARIZE_MAX_RETRIES,
  DEFAULT_SUMMARIZE_TIMEOUT_MS,
  MAX_SUMMARIZE_RETRIES,
  MAX_SUMMARIZE_TIMEOUT_MS,
  resolveLLMConfig,
} from "../../src/config/llm-config";

describe("resolveLLMConfig", () => {
  it("resolves provider/model/key from config and environment", () => {
    const config = resolveLLMConfig(
      {
        llm: {
          provider: "openai",
          model: "gpt-5-mini",
          api_key_env: "OPENAI_API_KEY",
        },
      },
      {
        OPENAI_API_KEY: "test-key",
      }
    );

    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-5-mini");
    expect(config.apiKey).toBe("test-key");
    expect(config.timeoutMs).toBe(DEFAULT_SUMMARIZE_TIMEOUT_MS);
    expect(config.maxRetries).toBe(DEFAULT_SUMMARIZE_MAX_RETRIES);
  });

  it("uses env overrides for provider and model", () => {
    const config = resolveLLMConfig(
      {
        llm: {
          provider: "openai",
          model: "gpt-5-mini",
        },
      },
      {
        RFAF_LLM_PROVIDER: "anthropic",
        RFAF_LLM_MODEL: "claude-3-7-sonnet",
        ANTHROPIC_API_KEY: "anthropic-key",
      }
    );

    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-3-7-sonnet");
    expect(config.apiKey).toBe("anthropic-key");
  });

  it("accepts summary defaults from config", () => {
    const config = resolveLLMConfig(
      {
        llm: {
          provider: "google",
          model: "gemini-2.0-flash",
        },
        summary: {
          default_preset: "long",
          timeout_ms: 12_000,
          max_retries: 3,
        },
      },
      {
        GOOGLE_GENERATIVE_AI_API_KEY: "google-key",
      }
    );

    expect(config.defaultPreset).toBe("long");
    expect(config.timeoutMs).toBe(12_000);
    expect(config.maxRetries).toBe(3);
  });

  it("throws for unsupported provider values", () => {
    expect(() =>
      resolveLLMConfig(
        {
          llm: {
            provider: "cohere",
            model: "command-r",
          },
        },
        {
          COHERE_API_KEY: "test",
        }
      )
    ).toThrow("Config error: invalid provider");
  });

  it("throws when provider key cannot be resolved", () => {
    expect(() =>
      resolveLLMConfig(
        {
          llm: {
            provider: "openai",
            model: "gpt-5-mini",
          },
        },
        {}
      )
    ).toThrow("Config error: missing API key");
  });

  it("throws when timeout exceeds max bound", () => {
    expect(() =>
      resolveLLMConfig(
        {
          llm: {
            provider: "openai",
            model: "gpt-5-mini",
          },
          summary: {
            timeout_ms: MAX_SUMMARIZE_TIMEOUT_MS + 1,
          },
        },
        {
          OPENAI_API_KEY: "test",
        }
      )
    ).toThrow("Config error: invalid summary.timeout_ms value");
  });

  it("throws when retries exceed max bound", () => {
    expect(() =>
      resolveLLMConfig(
        {
          llm: {
            provider: "openai",
            model: "gpt-5-mini",
          },
          summary: {
            max_retries: MAX_SUMMARIZE_RETRIES + 1,
          },
        },
        {
          OPENAI_API_KEY: "test",
        }
      )
    ).toThrow("Config error: invalid summary.max_retries value");
  });
});
