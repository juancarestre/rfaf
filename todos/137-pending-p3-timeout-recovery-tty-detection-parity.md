---
status: pending
priority: p3
issue_id: "137"
tags: [code-review, ux, cli, parity]
dependencies: []
---

# Timeout Recovery TTY Detection Parity

## Problem Statement

Timeout recovery interactivity uses `process.stdin.isTTY && process.stdout.isTTY`, which can misclassify prompt-capable sessions that rely on `/dev/tty` fallback input.

## Findings

- Interactivity checks are inline in multiple flow files and rely on `process.stdin` directly.
- Main CLI already supports fallback TTY input acquisition in startup/session handling.
- Review noted users in piped scenarios may be forced into automatic continue behavior without prompt choice.

## Proposed Solutions

### Option 1: Reuse Central Promptability Check (Preferred)

**Approach:** Share one helper for "can prompt user" across session and timeout recovery logic.

**Pros:**
- Consistent behavior across CLI features.
- Better UX in piped-input workflows.

**Cons:**
- Requires passing promptability context to flows.

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Explicit CLI Flag to Force Prompt/No Prompt

**Approach:** Add option to control timeout recovery prompting independent of TTY detection.

**Pros:**
- User-controlled deterministic behavior.

**Cons:**
- Additional CLI surface and docs.

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/translate-flow.ts`
- `src/cli/key-phrases-flow.ts`
- `src/cli/session-lifecycle.ts`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3

## Acceptance Criteria

- [ ] Promptability detection is consistent with CLI input strategy
- [ ] Piped-input + TTY fallback behavior is covered by contract tests
- [ ] Recovery prompt availability is deterministic and documented

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated TypeScript review feedback on interactivity detection.

**Learnings:**
- Promptability should be derived from runtime input strategy, not duplicated heuristics.
