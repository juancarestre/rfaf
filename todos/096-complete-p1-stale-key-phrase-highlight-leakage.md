---
status: complete
priority: p1
issue_id: "096"
tags: [code-review, quality, ui, correctness]
dependencies: []
---

# Reset Key-Phrase Match Flags On Re-annotation

Prevent stale key-phrase emphasis from leaking across repeated annotation runs.

## Problem Statement

When key phrases are reapplied to an existing `Word[]`, previously highlighted words can remain highlighted even when they should not match the new phrase set.

## Findings

- In `src/processor/key-phrase-annotation.ts:98`, non-matched words return the original object (`return word`).
- If a word previously had `keyPhraseMatch: true`, that flag can persist into subsequent runs.
- This is a correctness bug affecting both UI emphasis and agent runtime state.

## Proposed Solutions

### Option 1: Always Rewrite Match Flag

**Approach:** Return a fresh object for each word with `keyPhraseMatch` set explicitly from current match results.

**Pros:**
- Deterministic, no stale state
- Easy to reason about

**Cons:**
- Extra allocations

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Clear Existing Flags First

**Approach:** Normalize input by removing all prior `keyPhraseMatch` flags before matching.

**Pros:**
- Preserves optional structural sharing in matching path

**Cons:**
- Two-pass behavior unless carefully merged

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/processor/key-phrase-annotation.ts`
- `tests/processor/key-phrase-annotation.test.ts`

**Related components:**
- Key phrase annotation pipeline
- RSVP and guided scroll emphasis rendering

**Database changes:**
- No

## Resources

- `src/processor/key-phrase-annotation.ts:98`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [ ] Re-annotating with a different phrase set never leaves stale highlights
- [ ] Regression test proves stale flag leakage is impossible
- [ ] Existing annotation behavior remains deterministic for punctuation/case matches

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Captured P1 correctness finding from type-safety review
- Confirmed stale-state scenario and impact radius

**Learnings:**
- Re-annotation safety is essential when transforms can be rerun in agent flows.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Reworked annotation merge logic in `src/processor/key-phrase-annotation.ts` to clear stale `keyPhraseMatch` flags deterministically
- Added sparse structural sharing to avoid retaining stale flags while minimizing needless object churn
- Added regression coverage in `tests/processor/key-phrase-annotation.test.ts` (`clears stale key phrase flags on re-annotation`)

**Learnings:**
- Re-annotation paths must treat metadata as derived state, never incremental state.

## Notes

- This is a functional correctness issue, not just cleanup.
