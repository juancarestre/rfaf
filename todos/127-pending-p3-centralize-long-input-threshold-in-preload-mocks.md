---
status: pending
priority: p3
issue_id: "127"
tags: [code-review, tests, maintainability]
dependencies: []
---

# Centralize Long Input Threshold In Preload Mocks

Avoid drift between production long-input trigger threshold and test preload constants.

## Problem Statement

Preload fixtures hardcode `10_000` instead of importing the production trigger constant. If production threshold changes, tests can silently validate stale assumptions.

## Findings

- `tests/fixtures/preload-summary-mock.ts:4` sets `LONG_INPUT_THRESHOLD_BYTES = 10_000`.
- `tests/fixtures/preload-no-bs-mock.ts:4` duplicates same threshold constant.
- Production source of truth is `src/llm/long-input-chunking.ts:1` (`DEFAULT_LONG_INPUT_TRIGGER_BYTES`).

## Proposed Solutions

### Option 1: Import Production Constant In Preloads

**Approach:** Replace hardcoded literal with imported `DEFAULT_LONG_INPUT_TRIGGER_BYTES` in both preload files.

**Pros:**
- No config drift
- Minimal change

**Cons:**
- Test fixture now depends on source module import path stability

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Shared Test Constants Module

**Approach:** Export threshold from a dedicated test helper that itself imports production constant.

**Pros:**
- Cleaner fixture files

**Cons:**
- Extra file and indirection

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/fixtures/preload-summary-mock.ts`
- `tests/fixtures/preload-no-bs-mock.ts`
- `src/llm/long-input-chunking.ts`

## Acceptance Criteria

- [ ] Test preloads no longer hardcode long-input trigger literal.
- [ ] Threshold change in production automatically updates test behavior.
- [ ] All contract tests remain green.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Logged threshold drift-risk from simplicity/typescript review synthesis.

**Learnings:**
- Fixture constants should follow production source-of-truth when asserting contract boundaries.
