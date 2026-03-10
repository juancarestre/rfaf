---
status: pending
priority: p3
issue_id: "102"
tags: [code-review, simplicity, cli, refactor]
dependencies: ["095"]
---

# Simplify Key-Phrases Flow And Error Semantics

Trim avoidable complexity in key-phrases flow while preserving behavior.

## Problem Statement

The current implementation includes duplicated checks and extra pipeline work for list mode that can be simplified without reducing functionality.

## Findings

- `--key-phrases=list` still runs full pipeline transforms/tokenization before exiting (`src/cli/index.tsx:468`, `src/cli/reading-pipeline.ts:165`).
- CLI duplicates empty-phrases guard and classifies as usage error (`src/cli/index.tsx:470`) despite runtime/schema context.
- `maxPhrases` option plumbing is exposed across layers but not user-configurable in CLI yet (`src/cli/key-phrases-option.ts`, `src/cli/reading-pipeline.ts`, `src/agent/reader-api.ts`).
- Arg-normalization helper duplication risk exists with translate/key-phrases normalizers (`src/cli/index.tsx:161`, `:208`).

## Proposed Solutions

### Option 1: Early List Short-Circuit + Guard Cleanup

**Approach:** Run extraction flow only for list mode; remove duplicate empty guard from CLI and keep runtime error typing.

**Pros:**
- Clearer control flow
- Faster list mode startup

**Cons:**
- Requires minor refactor around pipeline invocation

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Keep Behavior, Document Intent

**Approach:** Keep current structure but add explicit comments/docs and tests to freeze behavior.

**Pros:**
- No structural change

**Cons:**
- Complexity remains
- Higher maintenance burden

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/cli/reading-pipeline.ts`
- `src/cli/key-phrases-option.ts`

**Related components:**
- CLI flow control
- Error classification

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] List mode avoids unnecessary tokenize/mode-transform work
- [ ] Empty-extraction failure semantics are runtime/schema, not usage
- [ ] Dead or premature abstraction in key-phrases option flow is reduced
- [ ] Behavior remains covered by contract tests

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Consolidated code-simplicity findings into targeted cleanup scope
- Linked to parity task dependency for error-contract alignment

**Learnings:**
- Small structural simplifications can reduce drift risk in CLI contracts.

## Notes

- Keep MVP scope tight; avoid adding new user-facing knobs during simplification.
