---
status: pending
priority: p3
issue_id: "100"
tags: [code-review, cli, tty, signal-handling]
dependencies: []
---

# Harden SIGINT Behavior During Interactive Quiz Loop

Interactive answer loop may not classify Ctrl+C consistently.

## Problem Statement

SIGINT handling is explicit during quiz generation, but listener coverage is removed before the readline-based answer loop. Mid-quiz Ctrl+C can bypass the same deterministic classification path used in generation.

## Findings

- SIGINT listener is attached/removed around generation in `src/cli/quiz-flow.ts:89` and `src/cli/quiz-flow.ts:120`.
- Interactive prompt happens later in `src/cli/quiz-flow.ts:142`.
- Security review flagged potential non-deterministic cancellation behavior in some PTY wrappers.
- Known pattern: lifecycle ownership and deterministic cleanup should span full interactive flow (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).

## Proposed Solutions

### Option 1: Keep SIGINT listener for full quiz lifecycle

**Approach:** Scope signal handling across generation + question loop, map cancellation to a single deterministic runtime envelope.

**Pros:**
- Strong consistency for Ctrl+C behavior
- Minimal architectural change

**Cons:**
- Must avoid duplicate listener registration

**Effort:** Small (1-2 hours)

**Risk:** Low

---

### Option 2: Central interactive lifecycle helper

**Approach:** Reuse a shared lifecycle wrapper for interactive flows (generation + prompting + cleanup).

**Pros:**
- Reduces lifecycle drift long-term

**Cons:**
- Larger scope than immediate need

**Effort:** Medium (2-4 hours)

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/quiz-flow.ts:89`
- `src/cli/quiz-flow.ts:120`
- `src/cli/quiz-flow.ts:142`

**Related components:**
- Signal handling and readline prompt lifecycle

**Database changes (if any):**
- None

## Resources

- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [ ] Ctrl+C during answer prompt yields deterministic error envelope
- [ ] Readline/input cleanup always occurs on cancellation
- [ ] PTY tests cover mid-quiz cancellation path
- [ ] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Traced signal listener scope boundaries in quiz flow
- Identified listener gap during prompt loop

**Learnings:**
- Cancellation determinism requires a lifecycle boundary that includes interactive prompting, not only LLM generation

## Notes

- Classified as P3 because current behavior is mostly safe but can be inconsistent across environments.
