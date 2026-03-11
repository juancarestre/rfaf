---
status: complete
priority: p2
issue_id: "121"
tags: [code-review, ui, performance, terminal]
dependencies: []
---

# Keep status line single-row under 80 columns

## Problem Statement

The status bar now appends long runtime hints on every render. On narrow terminals, the line wraps and can consume extra rows, which risks visual jitter and content clipping in guided scroll mode.

## Findings

- `src/ui/components/StatusBar.tsx:50` builds a long `runtimeHints` segment and appends it unconditionally.
- `src/ui/components/StatusBar.tsx:54` renders the full line each update tick.
- `src/ui/screens/GuidedScrollScreen.tsx:329` assumes fixed chrome height; wrapped status output can break this assumption.

## Proposed Solutions

### Option 1: Short hint in status, full list in overlay

**Approach:** Show only `? help` (or similarly short token) in status bar and keep full key list in help overlay.

**Pros:**
- Minimal risk
- Keeps status single-line

**Cons:**
- Less immediate discoverability for all shortcuts

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 2: Width-aware truncation/elision

**Approach:** Compute available width and elide hints dynamically.

**Pros:**
- Preserves richer hints when space exists
- Prevents wrap on narrow terminals

**Cons:**
- More rendering logic
- Additional test complexity

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Rotating paused-only hints

**Approach:** Show one hint group at a time, rotate only when paused/idle.

**Pros:**
- Good discoverability without long lines
- Reduces hot-path output volume during playback

**Cons:**
- More state/timing behavior

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

Implemented Option 2 with a width-aware status-line formatter that keeps output on one row, degrades hints from full to compact, and truncates lower-priority segments as needed.

## Technical Details

**Affected files:**
- `src/ui/components/StatusBar.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`
- `tests/ui/status-bar.test.tsx`

**Database changes (if any):**
- Migration needed? No

## Resources

- Branch: `feat/phase-8-subphase-32-help-shortcut`
- Review evidence: `src/ui/components/StatusBar.tsx:50`, `src/ui/screens/GuidedScrollScreen.tsx:329`

## Acceptance Criteria

- [x] Status line does not wrap on typical 80x24 terminals in steady state
- [x] Guided scroll viewport remains stable with no extra clipping/jitter
- [x] Help discoverability remains available (`?` path still obvious)
- [x] Relevant UI/PTY tests pass

## Work Log

### 2026-03-11 - Initial Discovery

**By:** Claude Code

**Actions:**
- Aggregated findings from TypeScript and performance review agents
- Confirmed long hint segment in status bar and fixed-height assumption in scroll layout
- Captured mitigation options with effort/risk

**Learnings:**
- TTY width constraints materially affect perceived quality in Ink apps
- Long static hints can degrade both readability and rendering stability

### 2026-03-11 - Resolution

**By:** Claude Code

**Actions:**
- Added width-aware status composition logic in `src/ui/components/StatusBar.tsx`
- Prioritized rendering fallbacks to keep status one-row while preserving key context
- Passed `maxWidth` from `src/ui/screens/RSVPScreen.tsx` and `src/ui/screens/GuidedScrollScreen.tsx`
- Updated status-related UI and PTY tests for bounded-width behavior

**Learnings:**
- A bounded single-line status contract is more stable than wrapped status text in terminal UIs
- Fallback priority must balance readability (`state`) and discoverability (`? help`) under tight widths
