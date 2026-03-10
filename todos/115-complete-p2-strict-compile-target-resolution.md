---
status: complete
priority: p2
issue_id: "115"
tags: [code-review, quality, build, reliability]
dependencies: []
---

# Enforce Strict Platform and Arch Target Resolution

## Problem Statement

Compile target selection currently falls back to x64 for unknown architectures instead of failing fast. This can produce late, confusing failures and brittle CI behavior on unsupported runners.

## Findings

- `scripts/build/compile-rfaf.ts:52` and `scripts/build/compile-rfaf.ts:56` treat non-arm64 as x64.
- `tests/cli/compiled-contract-helpers.ts:15` and `tests/cli/compiled-contract-helpers.ts:19` duplicate the same permissive fallback.
- Review agents flagged this as a deterministic reliability issue when new/unsupported arch values appear.

## Proposed Solutions

### Option 1: Exhaustive Switch + Fail Fast (Recommended)

**Approach:** Use explicit `(platform, arch)` matching and throw descriptive errors for unsupported combinations.

**Pros:**
- Deterministic, early failure.
- Easier troubleshooting in CI.

**Cons:**
- Requires updating map when adding new targets.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Fallback and Emit Warning

**Approach:** Preserve fallback but log warning with resolved target.

**Pros:**
- Minimal code changes.

**Cons:**
- Still allows invalid target assumptions.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented Option 1 with strict platform/architecture checks and fail-fast error messages.

## Technical Details

**Affected files:**
- `scripts/build/compile-rfaf.ts`
- `tests/cli/compiled-contract-helpers.ts`

## Resources

- Known Pattern: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Unsupported `(platform, arch)` combinations fail with explicit error message.
- [x] Tests assert strict target resolution behavior.
- [x] Test helper reuses production target resolver to prevent drift.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Synthesized TypeScript + simplicity review findings for target selection.

**Learnings:**
- Fail-fast target selection avoids hidden platform drift.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Updated `resolveCurrentTarget` in `scripts/build/compile-rfaf.ts` to reject unsupported arches per platform.
- Updated `tests/cli/compiled-contract-helpers.ts` to reuse shared resolver and compile args from build script.
- Added strict unsupported-arch assertions in `tests/build/compile-artifact-layout.test.ts`.

**Learnings:**
- Sharing target-resolution logic between runtime scripts and tests removes drift classes entirely.
