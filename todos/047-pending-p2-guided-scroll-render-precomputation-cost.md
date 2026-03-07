---
status: pending
priority: p2
issue_id: "047"
tags: [code-review, performance, ui, ink]
dependencies: []
---

# Reduce guided scroll render precomputation cost

## Problem Statement

Guided scroll currently sanitizes every word, computes the full line map, and materializes text for every line before rendering only the visible window. On large documents, mode switches and terminal resizes may feel sticky.

## Findings

- `src/ui/screens/GuidedScrollScreen.tsx:192` sanitizes all words.
- `src/ui/screens/GuidedScrollScreen.tsx:198` computes the full line map.
- `src/ui/screens/GuidedScrollScreen.tsx:202` builds `lineTexts` for every line, even though only a subset is rendered.
- Performance review flagged this as medium severity on the interactive path.
- Known pattern: guided-scroll measurement/rendering must remain aligned while avoiding unnecessary work (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).

## Proposed Solutions

### Option 1: Build text only for the visible line window

**Approach:** Keep the line map but defer string materialization to visible lines only.

**Pros:**
- Cuts repeated render work substantially
- Preserves current structure

**Cons:**
- Still computes the full line map on resize

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Cache sanitized words and per-width line artifacts

**Approach:** Memoize sanitized words and line data by `words` and `contentWidth`.

**Pros:**
- Better responsiveness on repeated switches/resizes
- Keeps rendering deterministic

**Cons:**
- More state/caching complexity

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 3: Accept current behavior for MVP

**Approach:** Leave as is and monitor only if users report latency.

**Pros:**
- No code churn

**Cons:**
- Leaves known interactive cost on large inputs

**Effort:** 0 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ui/screens/GuidedScrollScreen.tsx:192`
- `src/processor/line-computation.ts`
- `tests/ui/guided-scroll-screen-layout.test.tsx`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [ ] Guided scroll avoids eagerly building text for non-visible lines or otherwise proves performance is acceptable
- [ ] Existing guided-scroll rendering and highlight alignment tests still pass
- [ ] No regressions in line-wrap parity with rendered content

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Reviewed GuidedScrollScreen render-time work on the current branch
- Identified full-document preprocessing on resize/switch path

**Learnings:**
- This is a responsiveness concern, not an immediate correctness or security defect
