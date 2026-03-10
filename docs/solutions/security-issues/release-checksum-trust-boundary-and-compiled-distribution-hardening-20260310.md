---
module: Development Workflow
date: 2026-03-10
problem_type: security_issue
component: tooling
symptoms:
  - "Release checksum generation accepted artifact entries outside the compile-manifest trust boundary."
  - "Symlinked or unexpected files in the artifact directory could be hashed instead of rejected."
  - "Compile target resolution could fall back to a different architecture, producing mismatched binaries."
  - "Compiled PTY contract tests were timing-fragile and missed alternate-screen lifecycle assertions."
  - "Distribution workflows existed in CLI scripts but lacked agent-accessible parity APIs."
root_cause: missing_validation
resolution_type: code_fix
severity: high
tags: [release-integrity, checksums, compile-targets, pty-lifecycle, agent-parity, supply-chain]
---

# Troubleshooting: Release Checksum Trust Boundary and Compiled Distribution Hardening

## Problem

The new compiled distribution workflow worked functionally, but release integrity had a trust-boundary gap: checksum generation accepted broad directory contents instead of a strict expected-artifact set. In parallel, compile-target resolution and PTY contract coverage had deterministic reliability gaps that could mask release/runtime regressions.

## Environment

- Module: Development Workflow
- Affected Component: Tooling (`scripts/build/*`, `scripts/release/*`, compiled contract tests, agent parity wrappers)
- Date: 2026-03-10

## Symptoms

- Checksum generation could include files not declared by `compile-manifest.json`.
- Symlink artifacts were not rejected in checksum collection.
- Unsupported architectures could be coerced into x64 targets instead of failing immediately.
- PTY lifecycle tests relied on fixed sleeps and did not require alternate-screen enter/exit assertions.
- Agent surface could not run compile/checksum distribution workflows that users could run via CLI scripts.

## What Didn't Work

**Attempted Solution 1:** Directory-wide checksum scanning with a small filename exclusion list.
- **Why it failed:** This is permissive and not fail-closed; unknown artifacts can be included silently.

**Attempted Solution 2:** Architecture fallback to x64 when target arch is not arm64.
- **Why it failed:** Unsupported architectures fail later and non-obviously, making CI and release debugging harder.

**Attempted Solution 3:** Separate compile logic in test helpers.
- **Why it failed:** It duplicates production behavior and creates drift risk for contract tests.

## Solution

Hardened the distribution pipeline in five steps:

1. Enforced manifest-driven checksum allowlist and fail-closed validation.
2. Rejected symlink artifacts and unsafe filenames in checksum flow.
3. Made compile target resolution strict by platform + architecture.
4. Consolidated PTY harness with polling-based synchronization and explicit alt-screen assertions.
5. Added agent parity wrappers for compile/checksum workflows.

**Code changes**:

```ts
// scripts/release/generate-checksums.ts
for (const entry of dirEntries) {
  if (METADATA_FILES.has(entry)) continue;
  if (!expectedSet.has(entry)) {
    throw new Error(`Unexpected artifact entry in ${outDir}: ${entry}`);
  }
}
```

```ts
// scripts/release/generate-checksums.ts
const stats = lstatSync(fullPath);
if (stats.isSymbolicLink()) {
  throw new Error(`Symlink artifacts are not allowed for release checksums: ${file}`);
}
```

```ts
// scripts/build/compile-rfaf.ts
if (platform === "linux") {
  if (arch === "arm64") return "bun-linux-arm64";
  if (arch === "x64") return "bun-linux-x64-baseline";
  throw new Error(`Unsupported architecture for Linux target resolution: ${arch}`);
}
```

```ts
// tests/cli/compiled-runtime-lifecycle-pty.test.ts
expect(result.altScreenEntered).toBe(true);
expect(result.altScreenExited).toBe(true);
```

```ts
// src/agent/distribution-api.ts
export function executeAgentReleaseChecksumsCommand(...) {
  const outDir = command.outDir ?? DEFAULT_OUT_DIR;
  const manifest = runChecksums(outDir);
  return { outDir, manifest };
}
```

**Commands run**:

```bash
bun test tests/build/compile-artifact-layout.test.ts tests/build/release-checksum-manifest.test.ts tests/cli/compiled-*.test.ts tests/agent/distribution-api.test.ts
bun test
bun x tsc --noEmit
```

## Why This Works

1. Checksum generation now uses explicit expected-artifact inputs (`compile-manifest.json`), so checksum scope is deterministic and fail-closed.
2. Symlink and unsafe-name rejection closes common artifact-poisoning paths in local/CI output directories.
3. Strict target resolution makes unsupported platform/arch combinations fail fast with clear diagnostics.
4. Polling-based PTY harnesses reduce timing flake and add stronger lifecycle coverage for alternate-screen cleanup.
5. Agent parity wrappers eliminate a release-workflow capability gap between user CLI and agent surfaces.

Note: checksums provide integrity, not authenticity. Signature/attestation verification is still required at release time.

## Prevention

- Treat release checksum scope as a strict allowlist contract, never as a directory scan convenience.
- Reject symlinks and unsafe artifact filenames in release validation tooling.
- Treat `compile-manifest.json` as a trust root: enforce strict schema and reject duplicate/colliding artifact basenames.
- Keep compile target resolution explicit for each supported `(platform, arch)` pair.
- Reuse production build helpers in contract tests to prevent drift.
- Keep PTY lifecycle contracts output-driven (polling + timeout), not fixed-sleep based.
- Maintain CLI/agent parity for operational workflows (compile/checksum/release verification paths).
- Require authenticity controls (signing/provenance attestations) in addition to checksum verification.
- Keep race windows in mind for future hardening (for example, hash via secure file-handle workflow).

## Related Issues

- See also: `../logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- See also: `../runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- See also: `../integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- See also: `../integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- See also: `../integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- See also: `../workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
