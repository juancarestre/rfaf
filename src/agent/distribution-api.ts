import { readFileSync } from "node:fs";
import {
  compileArtifacts,
  DEFAULT_OUT_DIR,
  type CompileOptions,
  type CompilePlan,
} from "../../scripts/build/compile-rfaf";
import {
  generateReleaseChecksums,
  type ReleaseManifest,
} from "../../scripts/release/generate-checksums";

export interface AgentCompileDistributionCommand {
  outDir?: string;
  currentOnly?: boolean;
  version?: string;
  cwd?: string;
}

export interface AgentCompileDistributionResult {
  outDir: string;
  artifactCount: number;
  artifacts: Array<{
    target: CompilePlan["target"];
    file: string;
  }>;
}

export interface AgentReleaseChecksumsCommand {
  outDir?: string;
}

export interface AgentReleaseChecksumsResult {
  outDir: string;
  manifest: ReleaseManifest;
}

function readPackageVersion(cwd: string): string {
  const packageJson = JSON.parse(readFileSync(`${cwd}/package.json`, "utf8")) as {
    version: string;
  };

  return packageJson.version;
}

export function executeAgentCompileDistributionCommand(
  command: AgentCompileDistributionCommand,
  runCompile: (options: CompileOptions) => CompilePlan[] = compileArtifacts
): AgentCompileDistributionResult {
  const cwd = command.cwd ?? process.cwd();
  const outDir = command.outDir ?? DEFAULT_OUT_DIR;
  const version = command.version ?? readPackageVersion(cwd);
  const plan = runCompile({
    version,
    outDir,
    currentOnly: command.currentOnly ?? false,
    cwd,
  });

  return {
    outDir,
    artifactCount: plan.length,
    artifacts: plan.map((item) => ({
      target: item.target,
      file: item.outfile,
    })),
  };
}

export function executeAgentReleaseChecksumsCommand(
  command: AgentReleaseChecksumsCommand,
  runChecksums: (outDir: string) => ReleaseManifest = generateReleaseChecksums
): AgentReleaseChecksumsResult {
  const outDir = command.outDir ?? DEFAULT_OUT_DIR;
  const manifest = runChecksums(outDir);

  return {
    outDir,
    manifest,
  };
}
