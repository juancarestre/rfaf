---
status: completed
priority: p3
issue_id: "064"
tags: [code-review, quality, tests]
dependencies: []
---

# Clean Up Temporary Files Created In PDF Tests

Ensure tests that create temporary files remove them reliably.

## Problem Statement

One PDF ingest test creates temp files under `/tmp` and does not delete them. Repeated local/CI runs can accumulate unnecessary temp artifacts.

## Findings

- `tests/ingest/pdf.test.ts` creates temporary oversized PDF path and writes file.
- Test currently does not remove temp file in `finally`.

## Proposed Solutions

### Option 1: Add try/finally Cleanup (Recommended)

**Approach:** Wrap temp-file tests in `try/finally` and delete temp artifacts at end.

**Pros:**
- Very small change
- Keeps test environments clean

**Cons:**
- Minor boilerplate in tests

**Effort:** Small

**Risk:** Low

## Recommended Action

Implemented try/finally cleanup for temp files created by PDF raw-size tests.

## Technical Details

**Affected files:**
- `tests/ingest/pdf.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-16-pdf-ingestion`

## Acceptance Criteria

- [x] Temp file tests always clean up created files
- [x] No test behavior regressions

### 2026-03-08 - Implemented

**By:** OpenCode

**Actions:**
- Wrapped temp-file test in `try/finally` and removed file with `rm(..., { force: true })`.
- Verified suite remains green.

## Work Log

### 2026-03-08 - Initial Discovery

**By:** OpenCode

**Actions:**
- Logged test hygiene follow-up from TypeScript review.

**Learnings:**
- Test cleanup is cheap and prevents noisy local state over time.
