---
status: complete
priority: p2
issue_id: "090"
tags: [code-review, cli, reliability, no-bs]
dependencies: []
---

# Enforce Fail-Closed Validation for Invalid `--no-bs` Forms

## Problem Statement

Invalid valued/negated forms of `--no-bs` can be normalized by parser behavior before runtime checks, bypassing intended usage-error semantics.

## Findings

- Option is parsed as boolean in `src/cli/index.tsx`, and parser normalization can hide invalid forms.
- Guard in `resolveNoBsOption` does not consistently see raw invalid tokens.

## Proposed Solutions

### Option 1: Raw-arg validation for `--no-bs` variants (Recommended)

**Approach:** Inspect normalized raw argv for disallowed valued/negated forms (e.g., `--no-bs=something`, `--no-no-bs`) before final option resolution.

**Pros:**
- Deterministic usage contract.
- Keeps existing parser integration.

**Cons:**
- Adds explicit raw token validation logic.

**Effort:** Small

**Risk:** Low

### Option 2: Parse as string and coerce manually

**Approach:** Change parser type and own full coercion semantics in one place.

**Pros:**
- Full control.

**Cons:**
- More refactor churn.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented raw-arg fail-closed validation for `--no-bs` valued/negated forms before parser coercion.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/cli/no-bs-option.ts`
- `tests/cli/no-bs-option.test.ts`
- `tests/cli/no-bs-cli-contract.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Invalid no-bs forms always fail usage contract (exit 2).
- [x] Bare `--no-bs` continues to work.
- [x] Validation behavior is covered with contract tests.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured TypeScript reviewer finding on parser-layer bypass risk.

**Learnings:**
- Deterministic CLI contracts must validate raw user intent before parser coercion hides invalid values.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Added `validateNoBsArgs(rawArgs)` in `src/cli/index.tsx`.
- Added CLI contract tests for `--no-bs=...` and `--no-no-bs` fail-closed semantics.
- Verified exit code contract remains deterministic.

**Learnings:**
- Boolean parser options require explicit raw-token policy for strict contract guarantees.
