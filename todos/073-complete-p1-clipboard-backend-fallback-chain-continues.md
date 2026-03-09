---
status: complete
priority: p1
issue_id: "073"
tags: [code-review, reliability, cli, ingest]
dependencies: []
---

# Continue Clipboard Backend Fallback Chain

## Problem Statement

Clipboard ingestion currently stops after the first non-"command unavailable" backend failure, which can incorrectly fail on Linux even when later clipboard backends would succeed.

## Findings

- `src/ingest/clipboard.ts:120` breaks the loop after first backend runtime error.
- Linux candidate list includes multiple alternatives in `src/ingest/clipboard.ts:35`, but current control flow can skip viable later commands.
- This creates nondeterministic behavior across environments with partially working clipboard tools.

## Proposed Solutions

### Option 1: Try All Backends Before Failing

**Approach:** Replace early `break` with `continue`, track failures, and throw only after all candidates are attempted.

**Pros:**
- Maximizes resilience on mixed Linux setups.
- Preserves existing command order preference.

**Cons:**
- Slightly more code for failure aggregation.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Platform-Specific Single Backend

**Approach:** Keep only one backend per platform and fail immediately.

**Pros:**
- Simplest control flow.

**Cons:**
- Reduced compatibility; more false failures.

**Effort:** 1 hour

**Risk:** Medium

## Recommended Action

Implemented: clipboard backend probing now continues across all candidates and only fails after all backends are exhausted.

## Technical Details

**Affected files:**
- `src/ingest/clipboard.ts:99`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`
- **Known pattern:** `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`

## Acceptance Criteria

- [x] Clipboard backend probing attempts all configured candidates before terminal failure.
- [x] Deterministic error class remains stable after all attempts fail.
- [x] Linux fallback behavior covered by tests.
- [x] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated multi-agent review findings.
- Identified early-termination defect in clipboard backend loop.

**Learnings:**
- Multi-backend probing must not fail closed too early when deterministic compatibility is required.

### 2026-03-09 - Resolution

**By:** OpenCode

**Actions:**
- Updated `src/ingest/clipboard.ts` backend probing loop to continue across failures.
- Added fallback/continuation coverage in `tests/ingest/clipboard.test.ts`.
- Verified with `bun test` and `bun x tsc --noEmit`.

**Learnings:**
- Deterministic ingest behavior and compatibility improve when candidate probing is exhaustive.

## Notes

- P1 because behavior can fail in valid user environments and block feature usability.
