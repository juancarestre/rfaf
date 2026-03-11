import { createInterface } from "node:readline/promises";

export type TimeoutRecoveryOutcome = "continue" | "abort";

export interface TimeoutRecoveryInput {
  transformLabel: string;
  isInteractive: boolean;
  ask?: (prompt: string) => Promise<string>;
  inputStream?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WriteStream;
  allowNonInteractiveContinue?: boolean;
  promptTimeoutMs?: number;
}

const DEFAULT_PROMPT_TIMEOUT_MS = 30_000;

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function isContinueAnswer(value: string): boolean {
  const answer = normalizeAnswer(value);
  return answer === "" || answer === "y" || answer === "yes";
}

export async function resolveTimeoutRecoveryOutcome(
  input: TimeoutRecoveryInput
): Promise<TimeoutRecoveryOutcome> {
  if (!input.isInteractive) {
    return input.allowNonInteractiveContinue ? "continue" : "abort";
  }

  let closeAsk = () => {};
  const ask =
    input.ask ??
    (() => {
      const output = input.outputStream ?? process.stdout;
      const rl = createInterface({
        input: (input.inputStream ?? process.stdin) as NodeJS.ReadableStream,
        output,
        terminal: output.isTTY,
      });

      closeAsk = () => rl.close();
      return async (prompt: string) => rl.question(prompt);
    })();

  try {
    const promptTimeoutMs = Math.max(1, Math.trunc(input.promptTimeoutMs ?? DEFAULT_PROMPT_TIMEOUT_MS));

    const answer = await Promise.race<string>([
      ask(`[warn] ${input.transformLabel} timed out. Continue without this transform? [Y/n]: `),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("n"), promptTimeoutMs);
      }),
    ]);

    return isContinueAnswer(answer) ? "continue" : "abort";
  } catch {
    return "abort";
  } finally {
    closeAsk();
  }
}
