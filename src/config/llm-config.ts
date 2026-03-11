import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { SummaryPreset } from "../cli/summary-option";
import { DEFAULT_SUMMARY_PRESET } from "../cli/summary-option";
import { UsageError } from "../cli/errors";

export const DEFAULT_SUMMARIZE_TIMEOUT_MS = 40_000;
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
  display?: {
    text_scale?: string;
  };
  reading?: {
    mode?: string;
    wpm?: number;
  };
  defaults?: {
    summary_preset?: string;
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

export class MissingConfigFileError extends UsageError {
  readonly configPath: string;

  constructor(configPath: string) {
    super(`Config error: missing config file at ${configPath}. Create ~/.rfaf/config.yaml.`);
    this.name = "MissingConfigFileError";
    this.configPath = configPath;
  }
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
    throw new UsageError("Config error: invalid defaults.summary_preset value.");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "short" || normalized === "medium" || normalized === "long") {
    return normalized;
  }

  throw new UsageError("Config error: invalid defaults.summary_preset value.");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new UsageError(`Config error: unknown key ${path}.${key}.`);
    }
  }
}

function validateShape(rawConfig: unknown): RawRFAFConfig {
  if (!isRecord(rawConfig)) {
    throw new UsageError("Config error: root config must be a YAML object.");
  }

  ensureKnownKeys(rawConfig, ["llm", "display", "reading", "defaults"], "root");

  if (rawConfig.llm !== undefined && !isRecord(rawConfig.llm)) {
    throw new UsageError("Config error: llm must be an object.");
  }
  if (rawConfig.display !== undefined && !isRecord(rawConfig.display)) {
    throw new UsageError("Config error: display must be an object.");
  }
  if (rawConfig.reading !== undefined && !isRecord(rawConfig.reading)) {
    throw new UsageError("Config error: reading must be an object.");
  }
  if (rawConfig.defaults !== undefined && !isRecord(rawConfig.defaults)) {
    throw new UsageError("Config error: defaults must be an object.");
  }

  if (isRecord(rawConfig.llm)) {
    ensureKnownKeys(rawConfig.llm, ["provider", "model", "api_key", "api_key_env"], "llm");
  }
  if (isRecord(rawConfig.display)) {
    ensureKnownKeys(rawConfig.display, ["text_scale"], "display");
  }
  if (isRecord(rawConfig.reading)) {
    ensureKnownKeys(rawConfig.reading, ["mode", "wpm"], "reading");
  }
  if (isRecord(rawConfig.defaults)) {
    ensureKnownKeys(rawConfig.defaults, ["summary_preset", "timeout_ms", "max_retries"], "defaults");
  }

  return rawConfig as RawRFAFConfig;
}

function maybeWarnPermissiveConfig(configPath: string, rawConfig: RawRFAFConfig): void {
  if (!rawConfig.llm?.api_key?.trim()) {
    return;
  }

  try {
    const mode = statSync(configPath).mode & 0o777;
    if ((mode & 0o077) !== 0) {
      process.stderr.write(
        `[warn] Config warning: ${configPath} has permissive permissions (${mode.toString(8)}); consider chmod 600.\n`
      );
    }
  } catch {
    // Ignore permission-check failures; loading should continue.
  }
}

function migrationMessage(configPath: string, legacyPath: string): string {
  return [
    `Config error: TOML runtime config is no longer supported.`,
    `Detected legacy config at ${legacyPath}.`,
    `Migrate to YAML and save at ${configPath}.`,
    `Run: cp ${legacyPath} ${configPath} && edit ${configPath} to YAML format.`,
  ].join(" ");
}

function isValidEnvVarName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function resolveValidatedLLMConfig(
  config: RawRFAFConfig,
  env: Record<string, string | undefined>
): LLMConfig {
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
  if (configuredApiEnv && !isValidEnvVarName(configuredApiEnv)) {
    throw new UsageError("Config error: invalid llm.api_key_env value.");
  }

  const apiKeyEnv = configuredApiEnv || resolveDefaultApiKeyEnv(providerRaw);
  const apiKey = (env[apiKeyEnv] ?? config.llm?.api_key ?? "").trim();
  if (!apiKey) {
    throw new UsageError(
      `Config error: missing API key for ${providerRaw}. Set ${apiKeyEnv} or add llm.api_key/llm.api_key_env in config.yaml.`
    );
  }

  const defaultPreset = resolveSummaryPreset(config.defaults?.summary_preset);
  const timeoutMs = resolveBoundedInt(
    config.defaults?.timeout_ms,
    "defaults.timeout_ms",
    DEFAULT_SUMMARIZE_TIMEOUT_MS,
    1,
    MAX_SUMMARIZE_TIMEOUT_MS
  );
  const maxRetries = resolveBoundedInt(
    config.defaults?.max_retries,
    "defaults.max_retries",
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

export function resolveLLMConfig(
  rawConfig: unknown,
  env: Record<string, string | undefined>
): LLMConfig {
  const config = validateShape(rawConfig ?? {});
  return resolveValidatedLLMConfig(config, env);
}

export function defaultConfigPath(): string {
  return join(homedir(), ".rfaf", "config.yaml");
}

export function resolveConfigPath(env: Record<string, string | undefined>): string {
  return env.RFAF_CONFIG_PATH ?? defaultConfigPath();
}

export function loadLLMConfig(
  env: Record<string, string | undefined>,
  configPath = resolveConfigPath(env)
): LLMConfig {
  const legacyPath = join(dirname(configPath), "config.toml");

  if (!existsSync(configPath)) {
    if (!env.RFAF_CONFIG_PATH && existsSync(legacyPath)) {
      throw new UsageError(migrationMessage(configPath, legacyPath));
    }

    throw new MissingConfigFileError(configPath);
  }

  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(readFileSync(configPath, "utf8"));
  } catch {
    throw new UsageError(`Config error: unable to parse YAML at ${configPath}.`);
  }

  const shaped = validateShape(parsed);
  maybeWarnPermissiveConfig(configPath, shaped);

  return resolveValidatedLLMConfig(shaped, env);
}
