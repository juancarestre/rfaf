---
status: complete
priority: p1
issue_id: "116"
tags: [code-review, security, release, supply-chain]
dependencies: []
---

# Harden Release Artifact Trust Boundary

## Problem Statement

Release checksum generation currently trusts all files in the output directory and does not enforce authenticity requirements. This allows artifact poisoning and weakens release trust guarantees.

## Findings

- `scripts/release/generate-checksums.ts:23` hashes all files except two names, not an explicit allowlist.
- `scripts/release/generate-checksums.ts:29` follows resolved paths via `statSync`/`readFileSync`, including potential symlink targets.
- `scripts/release/generate-checksums.ts:56` can generate checksums/manifests even with zero expected binaries.
- `docs/release/compiled-distribution-checklist.md` lacks signature/provenance verification requirements.

## Proposed Solutions

### Option 1: Allowlist + Fail-Closed Integrity Policy (Recommended)

**Approach:** Derive expected artifacts from compile manifest/target matrix, reject unknown files/symlinks, require non-empty artifact set, and fail release if checks mismatch.

**Pros:**
- Strong deterministic release boundary.
- Prevents accidental or malicious extra artifact inclusion.

**Cons:**
- Requires strict artifact management in CI.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Keep Current Scope and Add Warnings

**Approach:** Continue broad hashing and warn when suspicious files are present.

**Pros:**
- Minimal change.

**Cons:**
- Still vulnerable to poisoning and weak authenticity posture.

**Effort:** Small

**Risk:** High

## Recommended Action

Implemented Option 1 with fail-closed artifact allowlist rules, symlink rejection, and non-empty artifact enforcement.

## Technical Details

**Affected files:**
- `scripts/release/generate-checksums.ts`
- `docs/release/compiled-distribution-checklist.md`
- `tests/build/release-checksum-manifest.test.ts`

## Resources

- Known Pattern: `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`
- Known Pattern: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] Checksum scope is restricted to expected artifact allowlist.
- [x] Symlinked artifacts are rejected.
- [x] Empty artifact set fails checksum generation.
- [x] Release checklist requires authenticity verification (signing/provenance).

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated security review findings on checksum and manifest boundaries.

**Learnings:**
- Integrity without authenticity is insufficient for distribution trust.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Hardened `scripts/release/generate-checksums.ts` to derive expected artifacts from `compile-manifest.json`.
- Added rejection for unknown entries and symlink artifacts; enforced non-empty artifact sets.
- Expanded tests in `tests/build/release-checksum-manifest.test.ts` for unexpected files, empty manifest, and symlink rejection.
- Updated `docs/release/compiled-distribution-checklist.md` and `docs/usage/compiled-binary-usage.md` with authenticity verification guidance.

**Learnings:**
- Release artifact integrity scripts should be policy-enforcing, not permissive inventory tools.
