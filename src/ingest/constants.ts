export const DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024;

export function assertInputWithinLimit(byteLength: number, maxBytes: number): void {
  if (byteLength > maxBytes) {
    throw new Error("Input exceeds maximum supported size");
  }
}
