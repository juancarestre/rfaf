---
status: pending
priority: p3
issue_id: "099"
tags: [code-review, quality, simplicity, cli]
dependencies: []
---

# Simplify Flag Parsing And Option Shapes

Trim small parser/option-shape duplication in strategy/summary handling to keep CLI code straightforward.

## Problem Statement

There are a few low-risk simplification opportunities: redundant branch logic in summary arg normalization, and an object wrapper for strategy that only carries a boolean.

## Findings

- `normalizeSummaryArgs` has an equivalent branch path for valid/invalid `--summary` next token handling:
  - `src/cli/index.tsx:148`
  - `src/cli/index.tsx:155`
- `StrategyOption` currently wraps a single `enabled` boolean:
  - `src/cli/strategy-option.ts:3`
  - `src/cli/strategy-option.ts:36`
- `wasStrategyFlagProvided` appears test-only and runtime-unused:
  - `src/cli/strategy-option.ts:9`
  - `tests/cli/strategy-args.test.ts:31`

## Proposed Solutions

### Option 1: Minimal Cleanup Pass

**Approach:** Remove redundant summary branch, flatten strategy option to boolean, and delete unused helper if still unused.

**Pros:**
- Lower cognitive load
- Small safe refactor

**Cons:**
- Requires touching already-stable parser code

**Effort:** 1-3 hours

**Risk:** Low

---

### Option 2: Shared Boolean-Flag Validator Helper

**Approach:** Extract reusable validator for bare boolean CLI flags (for `--no-bs`, `--strategy`, future flags).

**Pros:**
- Reduces duplication over time
- Consistent error text patterns

**Cons:**
- Slight abstraction risk if only used in two places

**Effort:** 2-4 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/cli/strategy-option.ts`
- `tests/cli/summary-args.test.ts`
- `tests/cli/strategy-option.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `compound-engineering.local.md`

## Acceptance Criteria

- [ ] Redundant parser branch removed with no behavior change.
- [ ] Strategy option shape simplified or justified as-is.
- [ ] Tests continue to assert deterministic CLI contracts.
- [ ] All affected tests remain green.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Captured code-simplicity reviewer findings and deduplicated overlap.
- Logged only non-blocking simplifications.

**Learnings:**
- Small parser cleanups reduce regression risk over future flag additions.
