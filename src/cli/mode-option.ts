export const READING_MODES = ["rsvp", "chunked", "bionic", "scroll"] as const;

export type ReadingMode = (typeof READING_MODES)[number];

export const DEFAULT_READING_MODE: ReadingMode = "rsvp";

function isReadingMode(value: string): value is ReadingMode {
  return READING_MODES.includes(value as ReadingMode);
}

function modeError(): Error {
  return new Error(`Invalid --mode value. Use one of: ${READING_MODES.join(", ")}.`);
}

export function resolveReadingMode(value: unknown): ReadingMode {
  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_READING_MODE;
  }

  if (typeof rawValue !== "string") {
    throw modeError();
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!isReadingMode(normalized)) {
    throw modeError();
  }

  return normalized;
}
