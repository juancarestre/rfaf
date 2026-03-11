---
title: "feat: Phase 8.33 automated releases and platform install docs"
type: feat
status: active
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-phase-8-subphase-33-release-automation-readme-installation-brainstorm.md
---

# feat: Phase 8.33 automated releases and platform install docs

## Overview

Implement Phase 8 subphase 33 by automating release publishing on merges to `main`, and update `README.md` to make prebuilt-binary installation the primary onboarding path across macOS, Linux, and Windows (see brainstorm: `docs/brainstorms/2026-03-11-phase-8-subphase-33-release-automation-readme-installation-brainstorm.md`).

This plan keeps direct GitHub release downloads in scope for now and leaves package-manager distribution out of scope (see brainstorm: `docs/brainstorms/2026-03-11-phase-8-subphase-33-release-automation-readme-installation-brainstorm.md`).

## Problem Statement / Motivation

Current repo has strong local compile/release tooling but no CI/CD workflow to publish releases automatically, and current installation docs are source-first rather than binary-first.

This increases friction for users who want to install quickly and creates manual release overhead.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-11-phase-8-subphase-33-release-automation-readme-installation-brainstorm.md`:

- Trigger release automation on every merge to `main` (see brainstorm: same file).
- Run quality gates before publish (`bun test`, compile, checksums/manifest) (see brainstorm: same file).
- Publish binaries for existing scripted target matrix (see brainstorm: same file).
- Make `README.md` prebuilt-binary-first for macOS/Linux/Windows (see brainstorm: same file).
- Keep Bun/source installation as secondary (see brainstorm: same file).
- Use direct GitHub release downloads only in this phase (see brainstorm: same file).

Open questions in brainstorm: none.

## Research Decision

Proceeding without external research.

Reason: repo already has deterministic compile/checksum contracts and tests; this work is integration + workflow orchestration, not unfamiliar technology.

## Consolidated Local Findings

- Compile matrix and artifact naming contract already implemented:
  - `scripts/build/compile-rfaf.ts:9`
  - `scripts/build/compile-rfaf.ts:41`
  - `scripts/build/compile-rfaf.ts:125`
- Release checksum/manifest generation is strict and fail-closed:
  - `scripts/release/generate-checksums.ts:34`
  - `scripts/release/generate-checksums.ts:64`
  - `scripts/release/generate-checksums.ts:77`
- Contract tests already enforce release artifact determinism:
  - `tests/build/compile-artifact-layout.test.ts:11`
  - `tests/build/release-checksum-manifest.test.ts:26`
- README currently emphasizes Bun/source install first:
  - `README.md:35`
  - `README.md:45`
- No existing GitHub workflow files are present (net-new workflow required).
- AGENTS.md quality/release conventions to preserve:
  - `AGENTS.md:51` (`bun test && bun x tsc --noEmit`)
  - `AGENTS.md:55` (release checksum flow)
  - `AGENTS.md:134` (preserve checksum/manifest safety checks)

## Proposed Solution

Create one GitHub Actions workflow for `main` merges that:

1. Runs quality gates in strict order.
2. Builds all compile targets.
3. Generates `SHA256SUMS` and `release-manifest.json` from compile manifest.
4. Creates/publishes release with full artifact set.
5. Uses deterministic, idempotent release behavior for reruns.

Update `README.md` so installation starts with prebuilt binaries, including per-platform direct-download instructions and checksum verification commands.

## Technical Approach (TDD-first)

### Phase 1: Contract Definition (Red)

- Add/extend tests first for release workflow expectations and README install contract.
- Add doc contract checks for required platform sections and command examples.
- Add workflow-level validation tests (or fixture checks) for required release steps and ordering.

Target files:
- `tests/build/release-checksum-manifest.test.ts` (extend where needed)
- `tests/build/compile-artifact-layout.test.ts` (extend where needed)
- `tests/cli/compiled-help-sections-contract.test.ts` or dedicated docs contract test for install section ordering (new)

### Phase 2: Workflow Implementation (Green)

- Add workflow file:
  - `.github/workflows/release.yml` (new)
- Ensure release pipeline invokes:
  - `bun test`
  - `bun x tsc --noEmit`
  - `bun run build:compile`
  - `bun run release:checksums --dir dist/bin`
- Publish artifacts from `dist/bin` including checksums and release manifest.
- Enforce concurrency and rerun/idempotency policy.

### Phase 3: README Installation Rewrite (Green)

- Update `README.md` install section to prebuilt-binary-first by OS.
- Keep Bun/source install as secondary section.
- Add per-platform checksum verification examples.

### Phase 4: Hardening and Validation

- Validate required asset set exactly matches compile/checksum manifest contracts.
- Validate release behavior on rerun and failure paths.
- Validate README commands and paths against emitted artifact names.

## Alternative Approaches Considered

- Manual release trigger after CI: safer but contradicts brainstorm decision for automatic on merge (see brainstorm: origin file).
- Split CI and release workflows: useful long-term, but unnecessary complexity for this phase.
- Package-manager installs now: out of scope by explicit brainstorm decision.

## SpecFlow Gaps Incorporated

This plan resolves identified gaps by making explicit:

- Version/tag source of truth and bump policy.
- Trigger semantics for “merge to main”.
- Rerun idempotency and duplicate release handling.
- Partial-failure behavior (draft/finalize or fail-cleanly).
- Exact required release asset set (no missing/extra drift).
- Concurrency control to prevent overlapping release races.

## System-Wide Impact

### Interaction Graph

Merge to `main` -> GitHub Actions workflow -> quality gates -> compile script -> compile manifest -> checksum script -> release assets upload -> README install flow consumed by users.

### Error & Failure Propagation

Any gate failure stops release publication. Artifact validation mismatch, missing expected files, or unsafe entries fail workflow prior to final publish.

### State Lifecycle Risks

Main risk is partial release state (some assets uploaded, release incomplete). Mitigate with deterministic publish policy and idempotent rerun behavior.

### API Surface Parity

CLI behavior remains unchanged; this phase affects distribution/ops/docs surfaces. Agent distribution helper expectations should remain aligned with artifact naming and checksums.

### Integration Test Scenarios

- Happy path publish with full expected artifact set.
- Gate failure prevents release.
- Rerun on same SHA follows idempotency policy.
- Concurrent merges do not create conflicting releases.
- README platform instructions map to actual artifact names.

## Acceptance Criteria

- [ ] A GitHub Actions workflow exists and runs on merges to `main` (see brainstorm: origin file).
- [ ] Workflow runs `bun test` and `bun x tsc --noEmit` before release steps.
- [ ] Workflow compiles all existing platform targets using repo scripts.
- [ ] Workflow generates and publishes `SHA256SUMS` and `release-manifest.json` with binaries.
- [ ] Publish behavior is deterministic and idempotent for reruns.
- [ ] Workflow enforces concurrency policy for release jobs.
- [ ] `README.md` presents prebuilt-binary install as primary onboarding for macOS/Linux/Windows (see brainstorm: origin file).
- [ ] `README.md` keeps Bun/source installation as secondary path (see brainstorm: origin file).
- [ ] README platform commands correspond to real artifact names/output.
- [ ] Package-manager distribution is explicitly out of scope for this phase (see brainstorm: origin file).

## Success Metrics

- Every merge to `main` can produce a deterministic releasable artifact set with checksums.
- New users can install from release assets without reading source-build instructions first.
- Reduced manual release steps and lower doc/support friction for installation.

## Dependencies & Risks

- **Risk:** tag/version collisions on rapid merges.
  - **Mitigation:** deterministic bump/version source and rerun policy.
- **Risk:** partial published release state.
  - **Mitigation:** fail-closed pipeline and finalize-only-on-complete strategy.
- **Risk:** README drift from emitted artifact names.
  - **Mitigation:** contract checks and review against compile naming logic.
- **Risk:** release security assumptions unclear.
  - **Mitigation:** explicitly document checksum trust boundaries and scope of signing/attestation (future phase).

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-03-11-phase-8-subphase-33-release-automation-readme-installation-brainstorm.md`
- Related phase source: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
- Internal references:
  - `package.json:12`
  - `scripts/build/compile-rfaf.ts:9`
  - `scripts/build/compile-rfaf.ts:41`
  - `scripts/release/generate-checksums.ts:34`
  - `tests/build/release-checksum-manifest.test.ts:26`
  - `README.md:35`
- Institutional learnings:
  - `docs/solutions/security-issues/release-checksum-trust-boundary-and-compiled-distribution-hardening-20260310.md`
  - `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
  - `docs/solutions/integration-issues/unified-timeout-reliability-parity-p1-p2-hardening-20260311.md`
