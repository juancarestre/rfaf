---
module: RSVP UI
date: 2026-03-05
problem_type: ui_bug
component: tooling
symptoms:
  - "Active RSVP words appeared near the top of the terminal instead of the visual center."
  - "Behavior regressed after layout adjustments made during text-scale readability fixes."
  - "Vertical centering felt inconsistent across presets during manual runs."
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [ink-layout, terminal-ui, rsvp, text-scale, regression, flexbox]
---

# Troubleshooting: RSVP Words Not Vertically Centered in Terminal

## Problem
After layout changes for text-scale readability, the RSVP word lane stopped rendering at terminal vertical center. Users saw words too close to the top, which reduced readability and broke the intended RSVP experience.

## Environment
- Module: RSVP UI
- Runtime: Bun + Ink terminal app
- Affected Component: RSVP screen lane layout (`RSVPScreen`)
- Date: 2026-03-05

## Symptoms
- Active word line rendered near top rows instead of center rows.
- Regression appeared after fixing horizontal drift in lane alignment.
- The issue was visible in normal terminal dimensions (around 24 rows).

## What Didn't Work

**Attempted Solution 1:** Change lane horizontal alignment to `alignItems: "flex-start"` only.
- **Why it failed:** It removed horizontal double-centering drift, but vertical centering still depended on axis behavior that was not explicitly defined.

**Attempted Solution 2:** Keep `justifyContent: "center"` without explicit lane direction.
- **Why it failed:** With default row direction, centering was applied on the wrong axis for this layout intent, so the lane did not reliably center vertically.

## Solution

Make the reading lane axis explicit and align responsibilities per axis:
- `flexDirection: "column"` to make `justifyContent` control vertical placement.
- `justifyContent: "center"` to center vertically.
- `alignItems: "flex-start"` to avoid adding extra horizontal centering on top of pivot padding.

**Code changes**:
```tsx
// src/ui/screens/RSVPScreen.tsx
export function getReadingLaneLayout(_: TextScalePreset): {
  flexDirection: "column";
  justifyContent: "center";
  alignItems: "flex-start";
} {
  return {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
  };
}

// Applied in lane container
<Box
  flexGrow={1}
  flexDirection={readingLaneLayout.flexDirection}
  justifyContent={readingLaneLayout.justifyContent}
  alignItems={readingLaneLayout.alignItems}
>
```

**Test coverage added/updated**:
- `tests/ui/rsvp-screen-layout.test.ts` now asserts:
  - lane layout uses `flexDirection: "column"`, `justifyContent: "center"`, `alignItems: "flex-start"`
  - rendered active word appears near center band for default terminal output

**Commands run**:
```bash
bun test tests/ui/rsvp-screen-layout.test.ts
bun test
bun x tsc --noEmit
```

## Why This Works

The bug was an axis-contract issue in Ink flex layout. In this UI, vertical centering must be controlled by lane container `justifyContent`, which only works predictably when direction is explicitly `column`. Separating axis concerns also prevents horizontal over-correction:
- lane container handles vertical centering
- word component handles horizontal pivot positioning

This removes the regression while preserving pivot alignment and text-scale behavior.

## Prevention

- Always set `flexDirection` explicitly for layout-critical Ink containers.
- Keep one concern per axis: parent for vertical placement, child for horizontal pivot logic.
- Add regression tests that assert rendered word line is near expected vertical midpoint.
- When adjusting alignment to fix one axis, add test coverage for the other axis before merging.

## Related Issues

- Text-scale plan and acceptance matrix: `docs/plans/2026-03-05-feat-rsvp-text-scale-readability-plan.md`
- Brainstorm decisions (including centering intent): `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`
- PTY validation notes: `docs/validation/2026-03-05-acceptance-pty.md`
- Related terminal hardening solution: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
