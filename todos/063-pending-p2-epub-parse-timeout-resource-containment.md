---
status: completed
priority: p2
issue_id: "063"
tags: [code-review, security, performance, ingestion, epub]
dependencies: []
---

# Improve EPUB Parse Timeout Resource Containment

Ensure timeout not only rejects caller but also contains ongoing parser work.

## Problem Statement

Current EPUB timeout races the parse promise and returns deterministic timeout errors, but underlying parse work may continue after timeout. This weakens runtime containment under hostile/slow EPUBs.

## Findings

- `src/ingest/epub.ts:81` implements Promise-race style timeout.
- No cancellation hook is wired into parser loop after timeout.
- Security/performance review flagged potential lingering CPU/memory burn.

## Proposed Solutions

### Option 1: Cooperative Cancellation Checks (Recommended)

**Approach:** Add timeout-controlled cancellation state and check between chapter iterations before continuing parse.

**Pros:**
- Small to medium scope
- Better containment without process architecture change

**Cons:**
- Cannot interrupt parser internals during an active chapter read

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Parse in Worker/Subprocess

**Approach:** Isolate EPUB parse in a worker/subprocess and terminate on timeout.

**Pros:**
- Strongest containment guarantee

**Cons:**
- Higher implementation/test complexity

**Effort:** Large

**Risk:** Medium

## Recommended Action

Implemented cooperative timeout containment by propagating an abort signal through timeout wrapper and checking it between chapter reads.

## Technical Details

**Affected files:**
- `src/ingest/epub.ts`
- `tests/ingest/epub.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`
- **Known pattern:** `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`

## Acceptance Criteria

- [x] Timeout path stops or cooperatively halts further chapter processing
- [x] Deterministic timeout error message remains stable
- [x] Timeout regression tests validate containment behavior
- [x] Full tests + typecheck pass

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Refactored EPUB timeout helper to create and abort an `AbortController` on timeout.
- Added cooperative abort checks before and after each chapter read in `parseEpubText(...)`.
- Added regression test verifying parser receives abort signal on timeout in `tests/ingest/epub.test.ts`.

**Learnings:**
- Promise timeout races should also surface cancellation hooks to reduce post-timeout work.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated timeout containment findings from security/performance review.
- Mapped current non-cancellable timeout behavior.

**Learnings:**
- Deterministic timeout messaging does not imply resource cleanup.
