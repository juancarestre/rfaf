import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLLMConfig } from "../../src/config/llm-config";

describe("YAML config permissions warning", () => {
  it("warns on permissive config mode with inline api key but still loads", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "rfaf-yaml-perms-"));
    const rfafDir = join(homeDir, ".rfaf");
    mkdirSync(rfafDir, { recursive: true });

    const configPath = join(rfafDir, "config.yaml");
    writeFileSync(
      configPath,
      [
        "llm:",
        "  provider: openai",
        "  model: gpt-4o-mini",
        "  api_key: inline-secret-key",
      ].join("\n")
    );
    chmodSync(configPath, 0o644);

    const originalWrite = process.stderr.write.bind(process.stderr);
    let stderr = "";
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stderr.write;

    try {
      const config = loadLLMConfig({}, configPath);
      expect(config.apiKey).toBe("inline-secret-key");
      expect(stderr).toContain("Config warning");
      expect(stderr).toContain("chmod 600");
    } finally {
      process.stderr.write = originalWrite;
    }
  });
});
