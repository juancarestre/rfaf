---
status: complete
priority: p2
issue_id: "118"
tags: [code-review, architecture, quality, testing]
dependencies: []
---

# Deduplicate Compile Contract Source of Truth

## Problem Statement

Compile target and argument logic are duplicated between build scripts and test helpers, increasing drift risk between what production builds do and what tests validate.

## Findings

- `tests/cli/compiled-contract-helpers.ts` reimplements target resolution and compile args.
- `scripts/build/compile-rfaf.ts` already defines compile matrix and argument builder.
- Simplicity review flagged this as high drift risk in a contract-sensitive path.

## Proposed Solutions

### Option 1: Reuse Production Build Module in Test Helper (Recommended)

**Approach:** Import/export shared target resolver and compile-arg builder from build module; remove duplicate helper logic.

**Pros:**
- Single source of truth.
- Lower maintenance overhead and fewer contract mismatches.

**Cons:**
- Tightens coupling between test helper and build module.

**Effort:** Small-Medium

**Risk:** Low

---

### Option 2: Keep Duplication with Mirror Tests

**Approach:** Retain separate logic and add strict tests to enforce equivalence.

**Pros:**
- Maintains isolation between prod and test modules.

**Cons:**
- Extra complexity for same outcome.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented Option 1 by reusing production compile contract helpers in compiled CLI test utilities.

## Technical Details

**Affected files:**
- `scripts/build/compile-rfaf.ts`
- `tests/cli/compiled-contract-helpers.ts`

## Resources

- Known Pattern: `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

## Acceptance Criteria

- [x] Test helper reuses build-script target and compile-arg logic.
- [x] No duplicate target matrix definitions remain.
- [x] Existing compiled contract tests remain green.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated simplicity + TS quality findings on compile helper drift.

**Learnings:**
- Contract tests are strongest when they consume production configuration directly.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Updated `tests/cli/compiled-contract-helpers.ts` to import `resolveCurrentTarget` and `buildCompileArgs` from `scripts/build/compile-rfaf.ts`.
- Removed duplicate target-resolution and compile-arg assembly logic from test helper.
- Revalidated compiled contract tests.

**Learnings:**
- Reusing production contract builders in tests sharply reduces behavioral drift risk.
