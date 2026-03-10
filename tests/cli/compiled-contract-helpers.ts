import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

let compiledBinaryPath: string | null = null;

function resolveCompileTarget(): string {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "bun-darwin-arm64" : "bun-darwin-x64";
  }

  if (process.platform === "linux") {
    return process.arch === "arm64" ? "bun-linux-arm64" : "bun-linux-x64-baseline";
  }

  if (process.platform === "win32") {
    return "bun-windows-x64-baseline";
  }

  throw new Error(`Unsupported platform for compile contract tests: ${process.platform}`);
}

function decode(output: ArrayBufferView | null): string {
  if (!output) return "";
  return Buffer.from(output.buffer, output.byteOffset, output.byteLength).toString("utf8");
}

export function runSourceCli(args: string[], env?: Record<string, string>, cwd?: string): CliRunResult {
  const result = Bun.spawnSync(["bun", "run", "src/cli/index.tsx", ...args], {
    cwd: cwd ?? process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
      ...env,
    },
    stderr: "pipe",
    stdout: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

export function compileTestBinary(): string {
  if (compiledBinaryPath) return compiledBinaryPath;

  const outDir = mkdtempSync(join(tmpdir(), "rfaf-compile-contract-"));
  const outFile = join(outDir, process.platform === "win32" ? "rfaf.exe" : "rfaf");
  const compileTarget = resolveCompileTarget();

  const result = Bun.spawnSync(
    [
      "bun",
      "build",
      "src/cli/index.tsx",
      "--compile",
      `--target=${compileTarget}`,
      "--outfile",
      outFile,
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      stderr: "pipe",
      stdout: "pipe",
    }
  );

  if (result.exitCode !== 0) {
    throw new Error(`Compile failed:\n${decode(result.stderr)}`);
  }

  compiledBinaryPath = outFile;
  return outFile;
}

export function runCompiledCli(args: string[], env?: Record<string, string>, cwd?: string): CliRunResult {
  const result = Bun.spawnSync([compileTestBinary(), ...args], {
    cwd: cwd ?? process.cwd(),
    env: {
      ...process.env,
      RFAF_NO_ALT_SCREEN: "1",
      ...env,
    },
    stderr: "pipe",
    stdout: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}
