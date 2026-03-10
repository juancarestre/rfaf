---
status: pending
priority: p3
issue_id: "112"
tags: [code-review, simplicity, maintainability, history]
dependencies: []
---

# Simplify History Schema and Normalization Paths

## Problem Statement

History persistence currently includes redundant normalization/sanitization and stores both canonical and derived duration fields, increasing maintenance and parser complexity without clear MVP benefit.

## Findings

- `src/history/history-store.ts:54` applies `sanitizeHistorySourceLabel(...).slice(...)`, while truncation already exists in sanitizer.
- `src/history/history-store.ts` persists both `durationMs` and `durationSeconds`, where seconds are derived.
- Multiple sanitization passes exist across record creation, parse, and persist boundaries.
- Known Pattern: keep merge-hotspot logic modular and minimal with contract tests (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solutions

### Option 1: Single Normalization Boundary (Recommended)

**Approach:** Normalize labels in one canonical place and remove duplicate truncation/sanitization passes.

**Pros:**
- Lower cognitive load.
- Fewer drift bugs between read/write paths.

**Cons:**
- Requires careful contract test updates.

**Effort:** Small

**Risk:** Low

---

### Option 2: Canonical Duration Field Only

**Approach:** Persist `durationMs` only and derive `durationSeconds` when rendering.

**Pros:**
- Smaller schema, simpler validation.

**Cons:**
- Minor render-time computation.

**Effort:** Small-Medium

**Risk:** Low

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/history/session-record.ts`
- `src/history/history-store.ts`
- `src/cli/history-command.ts`
- `tests/history/history-store-contract.test.ts`

## Resources

- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

## Acceptance Criteria

- [ ] Label sanitization/truncation logic has one canonical boundary.
- [ ] Persisted schema contains only canonical fields (no unnecessary derived duplication).
- [ ] Contract tests reflect simplified schema and remain deterministic.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated simplicity review findings for history storage module.
- Identified duplicate normalization and derived-field persistence.

**Learnings:**
- MVP features benefit from strict canonical data representation.
