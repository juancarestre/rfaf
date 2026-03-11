import {
  closeSync,
  chmodSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  constants as fsConstants,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { UsageError } from "./errors";
import { sanitizeTerminalText } from "../ui/sanitize-terminal-text";
import { defaultConfigPath, MissingConfigFileError } from "../config/llm-config";

const DEFAULT_PROMPT_TIMEOUT_MS = 30_000;
const CONFIG_TEMPLATE_PATH = fileURLToPath(new URL("../../config.yaml.example", import.meta.url));

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function isYesAnswer(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

async function promptCreateConfig(configPath: string, promptTimeoutMs?: number): Promise<boolean> {
  if (!isInteractiveTerminal()) {
    return false;
  }

  const safeConfigPath = sanitizeTerminalText(configPath);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const timeoutMs = Math.max(1, Math.trunc(promptTimeoutMs ?? DEFAULT_PROMPT_TIMEOUT_MS));
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const answer = await Promise.race<string>([
      rl.question(
        `[setup] Missing config at ${safeConfigPath}. Create it now from config.yaml.example? [Y/n]: `
      ),
      new Promise<string>((resolve) => {
        timeout = setTimeout(() => resolve("n"), timeoutMs);
        timeout.unref?.();
      }),
    ]);

    return isYesAnswer(answer);
  } catch {
    return false;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    rl.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForConfigReady(configPath: string): Promise<void> {
  const deadlineMs = Date.now() + 2_000;
  while (Date.now() < deadlineMs) {
    try {
      const stats = statSync(configPath);
      if (!stats.isFile() || stats.size === 0) {
        await sleep(25);
        continue;
      }

      const contents = readFileSync(configPath, "utf8");
      if (!contents.trim()) {
        await sleep(25);
        continue;
      }

      Bun.YAML.parse(contents);
      return;
    } catch {
      await sleep(25);
    }
  }

  throw new UsageError(
    `Config error: config file at ${configPath} is not ready yet. Re-run the command.`
  );
}

function createConfigFromTemplate(configPath: string): "created" | "exists" {
  try {
    mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  } catch {
    throw new UsageError(`Config error: unable to create parent directory for ${configPath}.`);
  }

  const createFlags =
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    fsConstants.O_WRONLY |
    (typeof fsConstants.O_NOFOLLOW === "number" ? fsConstants.O_NOFOLLOW : 0);

  let fd: number;
  try {
    fd = openSync(configPath, createFlags, 0o600);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      return "exists";
    }

    throw new UsageError(`Config error: unable to create config file at ${configPath}.`);
  }

  try {
    const template = readFileSync(CONFIG_TEMPLATE_PATH, "utf8");
    writeFileSync(fd, template, "utf8");
    fsyncSync(fd);
    fchmodSync(fd, 0o600);
  } catch {
    throw new UsageError(`Config error: unable to create config file at ${configPath}.`);
  } finally {
    closeSync(fd);
  }

  try {
    chmodSync(configPath, 0o600);
  } catch {
    throw new UsageError(
      `Config error: failed to set secure permissions on ${configPath}. Run chmod 600 ${configPath}.`
    );
  }

  return "created";
}

export async function maybeBootstrapMissingDefaultConfig(input: {
  env: Record<string, string | undefined>;
  transformRequested: boolean;
  failFastOnDecline?: boolean;
  promptTimeoutMs?: number;
}): Promise<void> {
  if (!input.transformRequested) {
    return;
  }

  if (input.env.RFAF_CONFIG_PATH) {
    return;
  }

  const configPath = defaultConfigPath();
  if (existsSync(configPath)) {
    return;
  }

  const shouldCreate = await promptCreateConfig(configPath, input.promptTimeoutMs);
  if (!shouldCreate) {
    if (input.failFastOnDecline ?? true) {
      throw new MissingConfigFileError(configPath);
    }

    return;
  }

  const outcome = createConfigFromTemplate(configPath);
  if (outcome === "created") {
    const safeConfigPath = sanitizeTerminalText(configPath);
    process.stderr.write(`[ok] Created config at ${safeConfigPath}.\n`);
    process.stderr.write(
      `[next] Add your API key in ${safeConfigPath} (llm.api_key or llm.api_key_env) so LLM features can run.\n`
    );
    return;
  }

  await waitForConfigReady(configPath);
}
