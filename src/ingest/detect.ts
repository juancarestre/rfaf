import { fstatSync } from "node:fs";

export interface ResolveInputSourceParams {
  fileArg?: string;
  stdinIsPiped: boolean;
}

export type InputSource =
  | { kind: "file"; path: string; warning?: string }
  | { kind: "url"; url: string; warning?: string }
  | { kind: "stdin" }
  | { kind: "none" };

export function resolveInputSource(
  params: ResolveInputSourceParams
): InputSource {
  const { fileArg, stdinIsPiped } = params;

  if (fileArg) {
    if (/^https?:\/\//i.test(fileArg)) {
      if (stdinIsPiped) {
        return {
          kind: "url",
          url: fileArg,
          warning: "URL argument provided; ignoring piped stdin",
        };
      }

      return { kind: "url", url: fileArg };
    }

    if (stdinIsPiped) {
      return {
        kind: "file",
        path: fileArg,
        warning: "Warning: file argument provided, ignoring stdin",
      };
    }

    return { kind: "file", path: fileArg };
  }

  if (stdinIsPiped) {
    return { kind: "stdin" };
  }

  return { kind: "none" };
}

export function isStdinPiped(): boolean {
  try {
    const stats = fstatSync(0);
    return stats.isFIFO() || stats.isFile();
  } catch {
    return false;
  }
}
