import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SummaryPreset } from "../cli/summary-option";
import { DEFAULT_SUMMARY_PRESET } from "../cli/summary-option";
import { UsageError } from "../cli/errors";

export const DEFAULT_SUMMARIZE_TIMEOUT_MS = 20_000;
export const DEFAULT_SUMMARIZE_MAX_RETRIES = 1;
export const MAX_SUMMARIZE_TIMEOUT_MS = 60_000;
export const MAX_SUMMARIZE_RETRIES = 5;

const PROVIDERS = ["openai", "anthropic", "google"] as const;
export type LLMProvider = (typeof PROVIDERS)[number];

interface RawRFAFConfig {
  llm?: {
    provider?: string;
    model?: string;
    api_key?: string;
    api_key_env?: string;
  };
  summary?: {
    default_preset?: string;
    timeout_ms?: number;
    max_retries?: number;
  };
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  defaultPreset: SummaryPreset;
  timeoutMs: number;
  maxRetries: number;
}

function isProvider(value: string): value is LLMProvider {
  return PROVIDERS.includes(value as LLMProvider);
}

function resolveDefaultApiKeyEnv(provider: LLMProvider): string {
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  return "GOOGLE_GENERATIVE_AI_API_KEY";
}

function resolveSummaryPreset(value: unknown): SummaryPreset {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_SUMMARY_PRESET;
  }

  if (typeof value !== "string") {
    throw new UsageError("Config error: invalid summary.default_preset value.");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "short" || normalized === "medium" || normalized === "long") {
    return normalized;
  }

  throw new UsageError("Config error: invalid summary.default_preset value.");
}

function resolveBoundedInt(
  value: unknown,
  field: string,
  fallback: number,
  min: number,
  max: number
): number {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new UsageError(`Config error: invalid ${field} value.`);
  }

  return value;
}

export function resolveLLMConfig(
  rawConfig: unknown,
  env: Record<string, string | undefined>
): LLMConfig {
  const config = (rawConfig ?? {}) as RawRFAFConfig;

  const providerRaw = (env.RFAF_LLM_PROVIDER ?? config.llm?.provider ?? "").trim().toLowerCase();
  if (!providerRaw || !isProvider(providerRaw)) {
    throw new UsageError(
      "Config error: invalid provider. Use one of: openai, anthropic, google."
    );
  }

  const model = (env.RFAF_LLM_MODEL ?? config.llm?.model ?? "").trim();
  if (!model) {
    throw new UsageError("Config error: missing model for selected provider.");
  }

  const configuredApiEnv = config.llm?.api_key_env?.trim();
  const apiKeyEnv = configuredApiEnv || resolveDefaultApiKeyEnv(providerRaw);
  const apiKey = (env[apiKeyEnv] ?? config.llm?.api_key ?? "").trim();
  if (!apiKey) {
    throw new UsageError(
      `Config error: missing API key for ${providerRaw}. Set ${apiKeyEnv}.`
    );
  }

  const defaultPreset = resolveSummaryPreset(config.summary?.default_preset);
  const timeoutMs = resolveBoundedInt(
    config.summary?.timeout_ms,
    "summary.timeout_ms",
    DEFAULT_SUMMARIZE_TIMEOUT_MS,
    1,
    MAX_SUMMARIZE_TIMEOUT_MS
  );
  const maxRetries = resolveBoundedInt(
    config.summary?.max_retries,
    "summary.max_retries",
    DEFAULT_SUMMARIZE_MAX_RETRIES,
    0,
    MAX_SUMMARIZE_RETRIES
  );

  return {
    provider: providerRaw,
    model,
    apiKey,
    defaultPreset,
    timeoutMs,
    maxRetries,
  };
}

export function defaultConfigPath(): string {
  return join(homedir(), ".rfaf", "config.toml");
}

export function loadLLMConfig(
  env: Record<string, string | undefined>,
  configPath = env.RFAF_CONFIG_PATH ?? defaultConfigPath()
): LLMConfig {
  if (!existsSync(configPath)) {
    throw new UsageError(
      `Config error: missing config file at ${configPath}. Create ~/.rfaf/config.toml.`
    );
  }

  let parsed: unknown;
  try {
    parsed = Bun.TOML.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new UsageError(`Config error: unable to parse TOML at ${configPath}.`);
  }

  return resolveLLMConfig(parsed, env);
}
