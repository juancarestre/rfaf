import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigPath, loadLLMConfig } from "../../src/config/llm-config";

function createYamlConfig(dir: string, body?: string): string {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "config.yaml");
  writeFileSync(
    filePath,
    body ??
      [
        "llm:",
        "  provider: openai",
        "  model: gpt-4o-mini",
        "defaults:",
        "  timeout_ms: 1000",
        "  max_retries: 0",
      ].join("\n")
  );
  return filePath;
}

describe("YAML loader contract", () => {
  it("uses ~/.rfaf/config.yaml as default path", () => {
    expect(defaultConfigPath().endsWith("/.rfaf/config.yaml")).toBe(true);
  });

  it("loads YAML config and resolves LLM settings", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-yaml-loader-"));
    const configPath = createYamlConfig(join(homeDir, ".rfaf"));

    const config = loadLLMConfig(
      {
        OPENAI_API_KEY: "dummy",
      },
      configPath
    );

    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4o-mini");
    expect(config.timeoutMs).toBe(1000);
    expect(config.maxRetries).toBe(0);
  });

  it("fails with deterministic migration guidance for TOML-only default home", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-yaml-migrate-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });
    writeFileSync(
      join(rfafDir, "config.toml"),
      ["[llm]", 'provider = "openai"', 'model = "gpt-4o-mini"'].join("\n")
    );

    expect(() =>
      loadLLMConfig(
        {
          OPENAI_API_KEY: "dummy",
        },
        join(rfafDir, "config.yaml")
      )
    ).toThrow("TOML runtime config is no longer supported");
  });

  it("parses YAML from RFAF_CONFIG_PATH when provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "rfaf-yaml-custom-"));
    const customPath = join(dir, "custom-config.yaml");
    writeFileSync(
      customPath,
      ["llm:", "  provider: anthropic", "  model: claude-3-7-sonnet", "defaults:", "  max_retries: 1"].join(
        "\n"
      )
    );

    const config = loadLLMConfig({
      RFAF_CONFIG_PATH: customPath,
      ANTHROPIC_API_KEY: "dummy",
    });

    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-3-7-sonnet");
    expect(config.maxRetries).toBe(1);
  });
});
