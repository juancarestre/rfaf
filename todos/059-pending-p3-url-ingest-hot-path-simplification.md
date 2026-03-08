---
status: pending
priority: p3
issue_id: "059"
tags: [code-review, performance, simplicity, refactor]
dependencies: []
---

# Simplify URL Ingest Hot Path and PTY Test Reuse

URL ingest and related tests contain small complexity/perf opportunities.

## Problem Statement

Current implementation is functional but has avoidable complexity in the ingest hot path (double readability pass and extra indirection) plus repeated PTY harness logic across tests.

## Findings

- `src/ingest/url.ts:125` does `isProbablyReaderable(...)` before `Readability.parse()` at `src/ingest/url.ts:129`.
- `src/ingest/url.ts` has helper indirection that can be flattened during error-path cleanup.
- `tests/cli/url-summary-pty-contract.test.ts` embeds custom PTY harness similar to other PTY tests.
- Simplicity and performance reviews both called out these cleanup opportunities.

## Proposed Solutions

### Option 1: Minimal Simplification Pass (Recommended)

**Approach:**
- Remove redundant pre-check where parse result validation is sufficient.
- Keep existing behavior contracts unchanged.
- Extract reusable PTY helper for URL/runtime PTY specs.

**Pros:**
- Lower maintenance cost
- Reduced duplicate logic

**Cons:**
- Requires careful contract-test confirmation

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Leave As-Is Until Next Refactor

**Approach:** Defer cleanup to future stabilization phase.

**Pros:**
- Zero immediate risk

**Cons:**
- Technical debt persists
- Future changes remain harder to reason about

**Effort:** 0 now

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ingest/url.ts`
- PTY tests under `tests/cli/*pty-contract.test.ts`

**Related components:**
- Readability extraction path
- TTY contract test infrastructure

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Review sources:** performance-oracle, code-simplicity-reviewer

## Acceptance Criteria

- [ ] URL ingest hot path has no redundant readability analysis step unless justified by benchmark/data
- [ ] PTY helper reuse reduces duplicated harness code
- [ ] Existing PTY and ingest contracts still pass

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Consolidated lower-severity perf + simplification findings
- Framed as optional cleanup task separate from correctness fixes

**Learnings:**
- Maintaining concise PTY test infrastructure improves long-term velocity.
