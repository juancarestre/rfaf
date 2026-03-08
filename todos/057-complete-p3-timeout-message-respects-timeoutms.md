---
status: complete
priority: p3
issue_id: "057"
tags: [code-review, quality, ux]
dependencies: []
---

# Align Timeout Error Message With Configured Timeout

Timeout errors currently always mention `10s` even when custom `timeoutMs` is provided.

## Problem Statement

The URL ingest API exposes `timeoutMs`, but timeout error text is hardcoded to `(10s limit)`. This creates misleading diagnostics for custom callers/tests and weakens API clarity.

## Findings

- `src/ingest/url.ts:75` computes `timeoutMs` from options.
- `src/ingest/url.ts:149` still throws fixed message `(10s limit)`.
- Reviewer flagged mismatch as API correctness/usability issue.

## Proposed Solutions

### Option 1: Render Dynamic Seconds Label (Recommended)

**Approach:** Build timeout label from effective `timeoutMs` and use in error message.

**Pros:**
- Accurate diagnostics
- Minimal change

**Cons:**
- Small test updates required

**Effort:** <1 hour

**Risk:** Low

---

### Option 2: Always Report Milliseconds

**Approach:** Use exact ms value in message for precision.

**Pros:**
- Unambiguous and precise

**Cons:**
- Slightly less readable for users

**Effort:** <1 hour

**Risk:** Low

## Recommended Action

Implemented dynamic timeout labeling derived from effective `timeoutMs`.

## Technical Details

**Affected files:**
- `src/ingest/url.ts`
- `tests/ingest/url.test.ts`

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Review source:** kieran-typescript-reviewer

## Acceptance Criteria

- [x] Timeout error reflects configured timeout value
- [x] Existing default behavior remains unchanged for default timeout
- [x] Tests cover non-default timeout messaging

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Isolated API-message mismatch finding from TypeScript review
- Scoped minimal fix and validation requirements

**Learnings:**
- Small messaging mismatches can undermine trust in runtime diagnostics.

### 2026-03-08 - Resolved

**By:** OpenCode

**Actions:**
- Updated timeout error formatting in `src/ingest/url.ts` to use effective configured timeout.
- Updated timeout regression test in `tests/ingest/url.test.ts` to validate non-default timeout messaging.

**Learnings:**
- Dynamic limits should always be reflected in user-facing diagnostics to preserve contract clarity.
