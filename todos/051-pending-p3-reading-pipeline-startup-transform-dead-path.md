---
status: pending
priority: p3
issue_id: "051"
tags: [code-review, simplification, cli, performance]
dependencies: []
---

# Remove unused startup mode transform from reading pipeline

## Problem Statement

The CLI reading pipeline still accepts `mode` and computes transformed startup words, but the runtime App now uses `sourceWords` and performs mode transformation itself. That leaves dead branching and extra startup work in the CLI path.

## Findings

- `src/cli/reading-pipeline.ts:26` still returns both `words` and `sourceWords`.
- `src/cli/index.tsx:259` now uses `sourceWords` and ignores transformed `words` for App bootstrapping.
- Code simplicity review flagged the remaining pipeline transform surface as unused on the hot path.

## Proposed Solutions

### Option 1: Reduce pipeline to summary + tokenize only

**Approach:** Return only `sourceWords` and `sourceLabel`, and keep all mode transforms in runtime/app helpers.

**Pros:**
- Clearer responsibilities
- Removes dead startup work

**Cons:**
- Requires updating tests and any remaining callers

**Effort:** 1-3 hours

**Risk:** Low

---

### Option 2: Keep current API but document `words` as legacy/internal

**Approach:** Leave the broader surface in place for compatibility.

**Pros:**
- Minimal churn

**Cons:**
- Keeps dead branching and conceptual confusion

**Effort:** < 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/reading-pipeline.ts`
- `src/cli/index.tsx`
- `tests/cli/summary-*.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Pipeline responsibilities are explicit and minimal
- [ ] Unused startup transform work is removed or intentionally justified
- [ ] CLI contract tests still pass

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Traced mode transformation from CLI pipeline into App bootstrapping
- Confirmed transformed `words` are no longer used by the main TUI path

**Learnings:**
- This is cleanup with mild startup-performance benefit, not a merge blocker
