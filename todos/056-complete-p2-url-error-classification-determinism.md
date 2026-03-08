---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, quality, error-handling, cli-contract]
dependencies: []
---

# Make URL Error Classification Deterministic

`readUrl` currently infers timeout/cancel from generic message substring checks.

## Problem Statement

Error classification based on `message.includes("timeout")` / `includes("abort")` can misclassify unrelated failures when URLs or upstream messages contain those words. This breaks deterministic CLI contracts and can emit incorrect failure reasons.

## Findings

- `src/ingest/url.ts:32` and `src/ingest/url.ts:38` rely on message heuristics.
- `src/ingest/url.ts:148` / `src/ingest/url.ts:152` remap caught errors based on those heuristics.
- Example risk noted in review: URL containing `timeout` could map HTTP errors to timeout incorrectly.
- Existing solution docs emphasize deterministic parse/error behavior (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).

## Proposed Solutions

### Option 1: Signal-State-First Classification (Recommended)

**Approach:** Use explicit signal state (`timeoutSignal.aborted`, parent signal aborted) and known abort error types, otherwise rethrow original error.

**Pros:**
- Deterministic and explicit
- Avoids brittle string logic

**Cons:**
- Requires slight refactor of signal plumbing

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Tighten Heuristics + Guard Clauses

**Approach:** Keep current logic but skip checks when error message is self-generated or URL-derived.

**Pros:**
- Smaller diff

**Cons:**
- Still heuristic and fragile
- Hard to prove correctness across cases

**Effort:** 1-2 hours

**Risk:** Medium

---

### Option 3: Typed Error Classes for Ingest Pipeline

**Approach:** Introduce explicit `UrlTimeoutError`, `UrlCancelledError`, `UrlHttpError`, etc.

**Pros:**
- Strongly typed, clean call-site handling
- Great long-term maintainability

**Cons:**
- Larger refactor
- Potentially overkill for current scope

**Effort:** 4-8 hours

**Risk:** Medium

## Recommended Action

Implemented Option 1 by removing message-substring heuristics and classifying timeout/cancel strictly from signal state and known abort error type.

## Technical Details

**Affected files:**
- `src/ingest/url.ts`
- `tests/ingest/url.test.ts`
- `tests/cli/url-cli-contract.test.ts`

**Related components:**
- CLI exit-code/message contract behavior

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Reference doc:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- **Review sources:** kieran-typescript-reviewer, code-simplicity-reviewer

## Acceptance Criteria

- [x] Timeout/cancel mapping uses explicit signal/error-type checks
- [x] Non-timeout failures cannot be remapped by URL text content
- [x] Tests cover keyword-in-URL false-positive scenarios
- [x] Error strings remain deterministic for existing contract tests

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Consolidated deterministic error-handling concerns across two reviewers
- Captured concrete false-positive risk and impacted contract surface

**Learnings:**
- Message-substring classification is brittle for URL-heavy errors.

### 2026-03-08 - Resolved

**By:** OpenCode

**Actions:**
- Removed `isTimeoutLikeError` / `isAbortLikeError` message matching from `src/ingest/url.ts`.
- Added explicit signal-based timeout/cancel mapping and kept non-signal failures untouched.
- Added regression tests for `timeout`/`abort` keywords in URL to prove HTTP errors are no longer misclassified in `tests/ingest/url.test.ts`.
- Updated timeout test to assert signal-driven timeout behavior deterministically.

**Learnings:**
- Signal-state-first classification keeps CLI contracts predictable and avoids false positives from user-provided URLs.

## Notes

- Pair naturally with issue `055` when refactoring ingest failure paths.
