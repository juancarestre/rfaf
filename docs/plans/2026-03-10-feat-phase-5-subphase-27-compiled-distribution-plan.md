---
title: "feat: Phase 5 Subphase 27 Compiled Distribution"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md
---

# feat: Phase 5 Subphase 27 Compiled Distribution

## Overview

Implement a deterministic distribution workflow for rfaf using `bun build --compile` so users can run a native binary without requiring a local Bun + source checkout.

This subphase is scoped to Phase 5 item 27 from the origin brainstorm (`bun build --compile` for distribution), while preserving existing runtime behavior and strict CLI contracts (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Problem Statement / Motivation

rfaf is currently source-first (`bun run src/cli/index.tsx`) with no compiled distribution pipeline. That blocks the brainstorm goal of a shareable tool that people can use immediately (see brainstorm: "The goal is a tool that's shareable on GitHub").

Without explicit compile/distribution contracts, we risk regressions in:

- terminal lifecycle safety for interactive TTY sessions,
- deterministic file-vs-stdin and exit-code behavior,
- cross-platform compatibility and artifact integrity.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`:

- Build remains CLI-first with yargs command/help conventions preserved in compiled mode (see brainstorm: "Keep yargs").
- Distribution must reinforce the shareable-GitHub outcome, not add product-surface scope (see brainstorm: "What We're Building", Phase 5 item 27).
- Current feature ordering remains intact: subphase 27 is distribution hardening after prior feature surfaces (see brainstorm: Revised Phase Plan).
- Previously resolved early-phase questions (Ink validation, ORP algorithm, speed ramping) remain out-of-scope for this subphase and should not be reopened here (see brainstorm: Resolved Questions).
- No unresolved brainstorm questions remain for this subphase (see brainstorm: Open Questions).

## Research Decision

External research is included for this plan.

Rationale: local repository patterns are strong, but compiled binary distribution is a tooling-specific area with platform caveats (CPU baseline, target matrix, compile flags, artifact integrity) that benefits from current Bun and release-practice guidance.

## Consolidated Research Findings

### Repository Patterns

- No existing compile/distribution script exists yet; current scripts are source-run oriented: `package.json:10`.
- CLI runtime entrypoint is Bun TSX with yargs and `scriptName("rfaf")`: `src/cli/index.tsx:1`, `src/cli/index.tsx:314`.
- `dist/` is already ignored, indicating expected artifact output location: `.gitignore:2`.
- Runtime includes Bun-native APIs and dynamic imports that must be verified under compile mode: `src/ingest/plaintext.ts:23`, `src/config/llm-config.ts:258`, `src/cli/reading-pipeline.ts:86`, `src/ingest/file-dispatcher.ts:61`.
- Interactive terminal lifecycle handling is explicit and must remain invariant in compiled mode: `src/cli/index.tsx:80`, `src/cli/index.tsx:85`, `src/cli/index.tsx:112`, `src/cli/session-lifecycle.ts:18`.
- Existing contract tests are source-run and should be mirrored or adapted for compiled binaries: `tests/cli/help-cli-contract.test.ts:4`, `tests/cli/runtime-mode-switching-pty-contract.test.ts:11`.

### Institutional Learnings Applied

- Preserve deterministic argv behavior and avoid environment-coupled parsing drift (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Keep terminal lifecycle restoration and sanitization as non-negotiable runtime invariants (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Prefer typed/stable failure contracts over heuristic error matching (`docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).
- Keep guard ordering deterministic and explicitly contract-tested (`docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`).
- Validate shared-entrypoint changes with targeted suites before full-suite execution (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

### External Research Highlights

- Bun compile references: `https://bun.com/docs/bundler/executables`, bytecode guidance: `https://bun.com/docs/bundler/bytecode`.
- Recommended deterministic compile flags include explicit autoload control for dotenv/bunfig behavior.
- Cross-platform release norms: per-target asset naming, checksums, optional signing/provenance attestation, and immutable release artifacts.
- Compatibility caveat: prefer baseline x64 target for broad CPU support when distributing publicly.

## SpecFlow Gaps Incorporated

SpecFlow analysis identified must-cover gaps now added to this plan:

- compiled-vs-source parity flow (output, exit codes, non-TTY behavior),
- terminal teardown guarantees on startup failures and signal exits,
- deterministic config precedence under compiled runtime,
- artifact integrity and release verification gates,
- explicit target matrix and failure policy for release blocking.

## Proposed Solution

Deliver subphase 27 as a contract-first distribution track:

1. Define compile/distribution contract (targets, naming, behavior parity, failure matrix).
2. Add build scripts + artifact layout for compiled binaries.
3. Add compiled-runtime contract tests (TTY/non-TTY and parity-focused smoke checks).
4. Add integrity outputs (checksums + manifest) and release checklist.
5. Document distribution usage and support matrix.

## Technical Considerations

- **Architecture impacts:** introduces build-and-distribute surface (`scripts/` + `dist/` artifacts) without changing user-facing reading features.
- **Performance implications:** compiled startup should be benchmarked against source-run path; no regressions in interactive responsiveness.
- **Security considerations:** artifact integrity (checksums), deterministic config loading, and optional signing/provenance for release trust.

## System-Wide Impact

- **Interaction graph:** compile command -> target artifacts -> smoke/contract checks -> release packaging -> user runtime execution.
- **Error propagation:** compile failures, smoke-test failures, and parity regressions must produce deterministic non-zero exit behavior in CI/release scripts.
- **State lifecycle risks:** terminal raw-mode/alt-screen cleanup must remain correct on startup errors and signal interruptions in compiled runtime.
- **API surface parity:** CLI behavior must remain equivalent between source-run and compiled-binary invocation; no hidden command drift.
- **Integration scenarios:** interactive TTY read flow, piped stdin flow, missing file flow, and `--help` flow each validated in source and compiled modes.

## Implementation Detail Level

This plan uses **MORE (Standard Issue)**: enough structure for safe cross-platform distribution without introducing unnecessary architectural expansion.

## TDD-First Implementation Phases

### Phase 1: Distribution Contract Tests (Red -> Green)

Add failing tests first:

- `tests/cli/compiled-help-contract.test.ts` (new)
- `tests/cli/compiled-non-tty-contract.test.ts` (new)
- `tests/cli/compiled-error-exit-contract.test.ts` (new)

Contract coverage:

- `--help` parity between source and compiled invocation,
- deterministic non-TTY behavior,
- deterministic exit/error envelope for common failure paths.

### Phase 2: Build Script and Artifact Layout (Red -> Green)

Add script and contract checks:

- `package.json` scripts for compile targets (new/updated)
- `scripts/build/compile-rfaf.ts` or `scripts/build/compile-rfaf.sh` (new)
- `tests/build/compile-artifact-layout.test.ts` (new)

Coverage:

- deterministic artifact names and locations,
- expected target matrix entries,
- build metadata capture for traceability.

### Phase 3: Runtime Safety Validation for Compiled Mode (Red -> Green)

Add PTY/interactive coverage:

- `tests/cli/compiled-runtime-lifecycle-pty.test.ts` (new)
- `tests/cli/compiled-signal-cleanup-pty.test.ts` (new)

Coverage:

- raw-mode and alternate-screen restoration after exit/error,
- deterministic cleanup on interrupt signals,
- no terminal corruption after forced exit path.

### Phase 4: Integrity and Release Verification (Red -> Green)

Add release verification contracts:

- `scripts/release/generate-checksums.ts` (new)
- `tests/build/release-checksum-manifest.test.ts` (new)
- `docs/release/compiled-distribution-checklist.md` (new)

Coverage:

- checksum file generation,
- artifact manifest consistency,
- blocked release if required artifact/verification step fails.

### Phase 5: Documentation and Operator UX (Green)

Update docs for distribution users/operators:

- `README.md` distribution section update
- `docs/usage/compiled-binary-usage.md` (new)

Include:

- supported targets,
- download/run examples,
- troubleshooting notes (TTY/non-TTY expectations).

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`
- run compile scripts and compiled smoke checks across defined targets in CI

## Acceptance Criteria

- [ ] Compiled artifacts are produced for the defined target matrix with deterministic naming.
- [ ] `rfaf --help` behavior is contract-equivalent between source-run and compiled binary.
- [ ] Compiled binary preserves deterministic file-vs-stdin resolution and exit-code contracts.
- [ ] Interactive compiled runtime restores terminal state correctly on normal exit and interruption.
- [ ] Release artifacts include checksums and manifest, and verification failures block release.
- [ ] Distribution usage is documented for end users and maintainers.
- [ ] Existing feature behavior is unchanged beyond distribution surface (scope guard).

## Success Metrics

- New users can run rfaf from released binaries without source checkout.
- CI can build and validate compiled artifacts reproducibly.
- No regressions in deterministic CLI contract tests after distribution changes.

## Dependencies & Risks

- **Risk:** cross-platform compile differences (target/runtime drift).
  - **Mitigation:** explicit target matrix and per-target smoke contracts.
- **Risk:** compiled mode terminal lifecycle regressions.
  - **Mitigation:** dedicated compiled PTY lifecycle tests.
- **Risk:** environment-driven config drift in compiled binaries.
  - **Mitigation:** explicit compile/runtime config precedence tests and docs.
- **Risk:** release artifact trust ambiguity.
  - **Mitigation:** checksums + manifest + optional signing/provenance follow-up.

## Sources & References

### Origin

- **Origin brainstorm:** `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
  - carried-forward decisions: shareable GitHub outcome, yargs contract continuity, phase-ordered scope discipline.

### Internal References

- `package.json:6`
- `package.json:8`
- `package.json:10`
- `.gitignore:2`
- `src/cli/index.tsx:1`
- `src/cli/index.tsx:314`
- `src/cli/session-lifecycle.ts:18`
- `tests/cli/help-cli-contract.test.ts:4`
- `tests/cli/runtime-mode-switching-pty-contract.test.ts:11`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

### External References

- `https://bun.com/docs/bundler/executables`
- `https://bun.com/docs/bundler/bytecode`
- `https://bun.com/docs/guides/runtime/codesign-macos-executable`
- `https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds`
- `https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/verifying-the-integrity-of-a-release`
