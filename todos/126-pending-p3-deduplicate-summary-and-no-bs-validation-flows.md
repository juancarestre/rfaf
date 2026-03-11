---
status: pending
priority: p3
issue_id: "126"
tags: [code-review, quality, maintainability]
dependencies: []
---

# Deduplicate Summary And No-BS Validation Flows

Refactor duplicated validation logic to reduce drift risk between single-pass and merged-chunk branches.

## Problem Statement

Both summary and no-bs paths duplicate similar validation blocks in two places (single-pass and post-merge). This increases maintenance overhead and can cause contract drift.

## Findings

- `src/llm/summarize.ts:402` and `src/llm/summarize.ts:461` repeat empty/language/length/size checks.
- `src/llm/no-bs.ts:451` and `src/llm/no-bs.ts:508` repeat empty/language/fact/content/size checks.
- Simplicity review flagged this as avoidable duplication in core runtime logic.

## Proposed Solutions

### Option 1: Extract Shared Validators Per Module

**Approach:** Introduce `validateSummaryOutput(...)` and `validateNoBsOutput(...)` helpers used by both paths.

**Pros:**
- Single source of truth per contract
- Lower drift risk

**Cons:**
- Small refactor touchpoints

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Generic Validation Pipeline Utility

**Approach:** Build reusable ordered guard runner abstraction for both modules.

**Pros:**
- Maximum reuse

**Cons:**
- Higher abstraction cost for MVP scope

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `src/llm/no-bs.ts`

## Acceptance Criteria

- [ ] Validation logic is centralized per transform module.
- [ ] Behavior and error messages remain identical.
- [ ] Existing test suite remains green.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Added maintainability drift-risk todo from simplicity review.

**Learnings:**
- Contract-heavy code benefits from single validation pathways.
