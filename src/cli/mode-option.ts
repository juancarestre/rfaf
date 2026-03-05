export const READING_MODES = ["rsvp", "chunked"] as const;

export type ReadingMode = (typeof READING_MODES)[number];

export const DEFAULT_READING_MODE: ReadingMode = "rsvp";

function isReadingMode(value: string): value is ReadingMode {
  return READING_MODES.includes(value as ReadingMode);
}

export function resolveReadingMode(value: unknown): ReadingMode {
  const rawValue = Array.isArray(value) ? value[value.length - 1] : value;

  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_READING_MODE;
  }

  if (typeof rawValue !== "string") {
    throw new Error("Invalid --mode value. Use one of: rsvp, chunked.");
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!isReadingMode(normalized)) {
    throw new Error("Invalid --mode value. Use one of: rsvp, chunked.");
  }

  return normalized;
}
