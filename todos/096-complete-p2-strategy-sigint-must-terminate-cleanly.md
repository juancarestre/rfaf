---
status: complete
priority: p2
issue_id: "096"
tags: [code-review, cli, ux, reliability]
dependencies: []
---

# Strategy SIGINT Should Exit Cleanly

Ensure Ctrl+C during strategy recommendation exits the command with terminal-safe cleanup instead of continuing into reading flow.

## Problem Statement

Current strategy cancellation behavior converts SIGINT-driven abort into a warning and then continues startup. This conflicts with user expectation that Ctrl+C cancels command execution.

## Findings

- `src/cli/strategy-flow.ts:80` converts SIGINT into aborted strategy signal.
- `src/cli/strategy-flow.ts:114` catches runtime error and returns warning instead of rethrowing terminal cancel.
- `src/cli/index.tsx:410` proceeds to pipeline after warning.
- Multi-agent findings flagged this as operator-safety/UX inconsistency.

## Proposed Solutions

### Option 1: Treat SIGINT As Terminal In Strategy Flow

**Approach:** Detect cancellation reason and rethrow a typed cancellation error; let top-level handler exit with expected semantics.

**Pros:**
- Matches user expectation for Ctrl+C
- Minimal surface change

**Cons:**
- Requires explicit cancellation classification and tests

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Return Structured Outcome With `cancelled: true`

**Approach:** Extend flow output model to include cancellation signal and terminate in `index.tsx`.

**Pros:**
- Explicit state modeling
- Keeps flow typed and testable

**Cons:**
- Broader plumbing changes

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/strategy-flow.ts`
- `src/cli/index.tsx`
- `tests/cli/strategy-flow.test.ts`
- `tests/cli/strategy-cli-contract.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `compound-engineering.local.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Ctrl+C during strategy stage terminates command deterministically.
- [ ] No strategy warning is emitted for explicit user cancellation.
- [ ] Alternate-screen/raw-mode cleanup behavior remains correct.
- [ ] Contract tests cover SIGINT during strategy path.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Collated TypeScript/security findings around cancellation semantics.
- Verified warning-return path in `src/cli/strategy-flow.ts:117`.

**Learnings:**
- Pre-read advisory features still need strict cancellation semantics in interactive CLIs.

### 2026-03-10 - Resolved

**By:** Claude Code

**Actions:**
- Added `UserCancelledError` in `src/cli/errors.ts`.
- Updated strategy flow to detect SIGINT cancellation and throw terminal cancel error instead of downgrading to warning (`src/cli/strategy-flow.ts`).
- Updated top-level CLI error handling to exit with code `130` for user cancellation (`src/cli/index.tsx`).
- Added cancellation unit coverage using parent abort signal and SIGINT reason (`tests/cli/strategy-flow.test.ts`).

**Learnings:**
- Treating SIGINT as a first-class terminal control path avoids ambiguous “warn and continue” behavior in interactive sessions.

## Notes

- Important reliability/UX issue; should be addressed before broad rollout.
