---
status: pending
priority: p1
issue_id: "130"
tags: [code-review, security, reliability, cli]
dependencies: []
---

# Non-Interactive Timeout Fail-Open Bypass

## Problem Statement

In non-interactive mode, timeout recovery always continues without the requested transform. This creates a fail-open path where transform guarantees can be bypassed by forcing timeout conditions.

## Findings

- `src/cli/timeout-recovery.ts:25` returns `"continue"` when `isInteractive` is false.
- Timeout flows then return untransformed/original content in `src/cli/summarize-flow.ts`, `src/cli/no-bs-flow.ts`, `src/cli/translate-flow.ts`, and `src/cli/key-phrases-flow.ts`.
- `tests/llm/timeout-outcome-contract.test.ts` currently codifies this behavior.
- Security reviewer flagged this as high risk for scripted/CI usage where users expect fail-closed semantics.

## Proposed Solutions

### Option 1: Fail-Closed by Default (Preferred)

**Approach:** Make non-interactive timeout recovery default to `abort` and non-zero exit.

**Pros:**
- Strongest safety; no silent bypass.
- Clear machine semantics for automation.

**Cons:**
- Behavioral change for existing scripts.

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Explicit Opt-In Continue Flag

**Approach:** Keep default fail-closed, add explicit `--timeout-continue` (or env var) for scripted fallthrough.

**Pros:**
- Preserves safety while allowing controlled resilience.

**Cons:**
- Adds option surface and docs overhead.

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/timeout-recovery.ts`
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/translate-flow.ts`
- `src/cli/key-phrases-flow.ts`
- `tests/llm/timeout-outcome-contract.test.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3
- **Known Pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Non-interactive timeout default is fail-closed OR guarded by explicit opt-in
- [ ] Exit code and stderr are deterministic for timeout skip/abort outcomes
- [ ] Contract tests updated for intended policy
- [ ] Full suite passes

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated security + parity review findings.
- Identified fail-open control point and affected flows.

**Learnings:**
- Resilience behavior conflicts with strict transform guarantee expectations in automation contexts.
