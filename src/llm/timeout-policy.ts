export const ADAPTIVE_TIMEOUT_MEDIUM_INPUT_BYTES = 10_000;
export const ADAPTIVE_TIMEOUT_LARGE_INPUT_BYTES = 50_000;

function normalizeBaseTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
}

function toInputBytes(input: string | number): number {
  if (typeof input === "number") {
    return Math.max(0, Math.trunc(input));
  }

  return Buffer.byteLength(input, "utf8");
}

export function resolveAdaptiveTimeoutMs(baseTimeoutMs: number, input: string | number): number {
  const normalizedBase = normalizeBaseTimeoutMs(baseTimeoutMs);
  const inputBytes = toInputBytes(input);

  let multiplier = 1;
  if (inputBytes > ADAPTIVE_TIMEOUT_LARGE_INPUT_BYTES) {
    multiplier = 3;
  } else if (inputBytes > ADAPTIVE_TIMEOUT_MEDIUM_INPUT_BYTES) {
    multiplier = 2;
  }

  const hardCap = normalizedBase * 3;
  return Math.max(1, Math.min(hardCap, normalizedBase * multiplier));
}

export function createTimeoutDeadline(timeoutMs: number, nowMs = Date.now()): number {
  return nowMs + normalizeBaseTimeoutMs(timeoutMs);
}

export function resolveRemainingTimeoutMs(deadlineMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.trunc(deadlineMs - nowMs));
}
