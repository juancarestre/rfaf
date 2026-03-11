---
status: pending
priority: p2
issue_id: "133"
tags: [code-review, reliability, ux, cli]
dependencies: []
---

# Timeout Prompt SIGINT and Bounded Wait Safety

## Problem Statement

Timeout recovery prompting can behave poorly under cancellation and may wait indefinitely for user input.

## Findings

- Timeout prompt waits on `readline.question(...)` with no deadline in `src/cli/timeout-recovery.ts`.
- Flow-specific SIGINT handlers may still be active when entering recovery prompt, potentially intercepting Ctrl+C in non-obvious ways.
- Security and TS reviews both flagged availability/UX risks (stuck sessions and confusing cancellation behavior).

## Proposed Solutions

### Option 1: Add Prompt Deadline + Unified Cancellation (Preferred)

**Approach:** Add bounded wait (e.g., 15-30s), AbortSignal support, and deterministic Ctrl+C mapping to abort.

**Pros:**
- Prevents indefinite hangs.
- Predictable user cancellation behavior.

**Cons:**
- Requires prompt API expansion.

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Remove Interactive Prompt on Timeout

**Approach:** Use policy-only behavior (always continue or always abort), no prompt.

**Pros:**
- Simplest runtime behavior.

**Cons:**
- Removes user choice in interactive sessions.

**Effort:** 1-2 hours

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

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3

## Acceptance Criteria

- [ ] Recovery prompt cannot block indefinitely
- [ ] Ctrl+C at recovery prompt leads to deterministic abort behavior
- [ ] SIGINT listeners are cleaned up correctly around prompt lifecycle
- [ ] Flow and contract tests cover prompt cancellation path

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated timeout prompt availability and signal-handling findings.

**Learnings:**
- Prompt and transform cancellation must share one explicit cancellation contract.
