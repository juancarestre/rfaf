---
status: pending
priority: p3
issue_id: "050"
tags: [code-review, architecture, quality, simplification]
dependencies: []
---

# Simplify screen components to controlled-only runtime state

## Problem Statement

`App` is now the production owner of reader/session/help state, but both screen components still keep fallback local state and branching for uncontrolled usage. That leaves a second runtime model in production code that the main CLI flow does not use.

## Findings

- `src/ui/App.tsx:32` always passes controlled runtime props from App.
- `src/ui/screens/RSVPScreen.tsx:32` and `src/ui/screens/GuidedScrollScreen.tsx:38` still support optional `reader`, `session`, `helpVisible`, restart, and quit props with local-state fallbacks.
- Code simplicity review flagged this as a meaningful but non-blocking simplification opportunity.

## Proposed Solutions

### Option 1: Make both screens controlled-only

**Approach:** Require controlled props and remove fallback local state from production components.

**Pros:**
- Single runtime model
- Smaller input/timer/restart code paths

**Cons:**
- Requires updating screen tests or adding a small harness

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Keep current structure and add a dedicated test harness later

**Approach:** Leave the dual mode in place until a later cleanup pass.

**Pros:**
- No immediate churn

**Cons:**
- Keeps extra branching in production code

**Effort:** 0 hours now / 2-4 later

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ui/App.tsx`
- `src/ui/screens/RSVPScreen.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`
- `tests/ui/*screen*.test*`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`

## Acceptance Criteria

- [ ] Screen components have a single clear ownership model for runtime state
- [ ] Tests still cover isolated screen rendering as needed
- [ ] No change in user-visible behavior

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Compared App-owned runtime path to screen fallback logic
- Confirmed the uncontrolled branch is unused by the main CLI flow

**Learnings:**
- This is cleanup/simplification work, not a correctness blocker
