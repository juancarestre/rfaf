---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, quality, ui, ux]
dependencies: []
---

# Clarify help overlay mode-switch contract

## Problem Statement

The help overlay tells users `1-4` switches reading modes, but the app currently ignores those keys while help is visible. That makes the documented hotkey contract misleading in the exact screen that explains it.

## Findings

- `src/ui/components/HelpOverlay.tsx:17` renders `1-4        switch mode`.
- `src/ui/runtime-mode-state.ts:100` returns early when `runtime.helpVisible` is `true`, so mode-switch inputs are blocked.
- In the TTY this presents as a visible UX inconsistency rather than a crash, but it can make the feature feel broken.
- Known pattern: keep interactive contracts explicit and deterministic (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).

## Proposed Solutions

### Option 1: Allow 1-4 to work while help is visible

**Approach:** Let mode-switch inputs bypass the `helpVisible` guard while keeping other keys blocked.

**Pros:**
- Matches the help text exactly
- Reduces user confusion

**Cons:**
- Changes current input-modal behavior
- Needs careful PTY verification

**Effort:** 1-2 hours

**Risk:** Medium

---

### Option 2: Update help text to match current behavior

**Approach:** Change the overlay copy to say users must close help before using `1-4`.

**Pros:**
- Minimal code change
- Preserves current modal input behavior

**Cons:**
- Slightly less convenient UX
- Keeps the extra interaction step

**Effort:** < 1 hour

**Risk:** Low

---

### Option 3: Show mode-switch hint outside the help overlay only

**Approach:** Remove the binding from help and rely on persistent status/help elsewhere.

**Pros:**
- Avoids modal inconsistency entirely

**Cons:**
- Reduces discoverability in the canonical help surface

**Effort:** 1 hour

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ui/components/HelpOverlay.tsx:17`
- `src/ui/runtime-mode-state.ts:93`
- `tests/ui/help-overlay-mode-keys.test.tsx`
- `tests/cli/runtime-mode-switching-pty-contract.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Plan:** `docs/plans/2026-03-06-feat-phase-3-subphase-14-runtime-mode-switching-plan.md`
- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [ ] Help overlay behavior and copy are aligned
- [ ] PTY or integration coverage verifies the chosen contract
- [ ] No existing help-overlay controls regress

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Identified mismatch between help copy and blocked mode-switch input
- Traced the behavior through help overlay rendering and App runtime mode-input guard

**Learnings:**
- The issue is user-facing contract clarity, not a crash or security problem

## Notes

- This is a review finding from the current branch review, not a protected-artifact cleanup suggestion.
