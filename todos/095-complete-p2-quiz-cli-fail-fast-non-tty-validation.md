---
status: complete
priority: p2
issue_id: "095"
tags: [code-review, cli, tty, reliability]
dependencies: []
---

# Fail Fast Non-TTY Quiz Validation

`--quiz` currently validates TTY output too late in the CLI flow.

## Problem Statement

When `--quiz` is used in a non-interactive environment, the command can perform source resolution and ingestion work before returning a usage error. This adds unnecessary side effects and latency for an invocation that should fail immediately.

## Findings

- TTY output check is performed after ingestion and warning output in `src/cli/index.tsx:417`.
- Input resolution and read operations happen earlier in `src/cli/index.tsx:337` and `src/cli/index.tsx:352`.
- Type review flagged this as a deterministic contract gap for CLI behavior.
- Known pattern: deterministic option contracts should fail as early as possible (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).

## Proposed Solutions

### Option 1: Early validation right after option resolution

**Approach:** Move `--quiz` non-TTY guard to immediately after `resolveQuizOption` and before any source resolution or ingestion.

**Pros:**
- Fastest and simplest fix
- Prevents unnecessary file/network/clipboard work

**Cons:**
- Requires careful placement to preserve help/version semantics

**Effort:** Small (30-60 min)

**Risk:** Low

---

### Option 2: Centralized preflight validation block

**Approach:** Add a preflight function for cross-option environment checks (TTY requirements, incompatible combinations) executed before ingestion.

**Pros:**
- Creates clearer contract boundary
- Easier to extend for future flags

**Cons:**
- Slightly larger refactor

**Effort:** Medium (1-2 hours)

**Risk:** Low

## Recommended Action

Implemented Option 1 by moving non-TTY `--quiz` validation to early CLI preflight and adding contract tests that prove failure occurs before file/URL ingestion side effects.

## Technical Details

**Affected files:**
- `src/cli/index.tsx:417`
- `tests/cli/quiz-cli-contract.test.ts:37`

**Related components:**
- CLI option resolution and source detection pipeline

**Database changes (if any):**
- None

## Resources

- **Review target:** current branch `feat/phase-5-subphase-23` (local uncommitted review)
- **Known pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] `--quiz` non-TTY invocations fail before any source ingestion side effects
- [x] Help/version behavior remains unchanged
- [x] CLI contract tests cover fail-fast timing expectations
- [x] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Reviewed CLI control flow and option validation ordering
- Confirmed late `--quiz` TTY guard location
- Logged deterministic fail-fast requirement

**Learnings:**
- The codebase favors explicit deterministic CLI contracts with dedicated contract tests

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Moved non-TTY `--quiz` guard to pre-ingestion path in `src/cli/index.tsx`
- Added fail-fast tests for missing-file and URL invocation in `tests/cli/quiz-cli-contract.test.ts`
- Verified no fetch spinner appears for non-TTY quiz URL runs

**Learnings:**
- Preflight environment validation keeps CLI behavior deterministic and side-effect-free on invalid invocations

## Notes

- This is a behavior-contract hardening task, not a feature expansion.
