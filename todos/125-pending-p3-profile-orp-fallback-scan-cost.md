---
status: pending
priority: p3
issue_id: "125"
tags: [code-review, performance, ui, terminal]
dependencies: []
---

# Profile ORP Fallback Scan Cost on Render Loop

Validate that linear nearest-visible pivot scanning remains performant under extreme token lengths and high WPM update rates.

## Problem Statement

The new ORP fallback uses a linear scan from raw ORP outward to find a visible character. This is acceptable for typical chunk sizes, but there is no explicit profiling/guardrail for pathological long tokens rendered at high update frequency.

## Findings

- `src/ui/components/WordDisplay.tsx:37` performs a `for` loop up to `displayWord.length` in worst case.
- `src/ui/components/WordDisplay.tsx:163` calls layout generation during rendering.
- Performance review and security review both flagged potential low-severity CPU pressure for oversized unsplit tokens.
- Existing expanded-mode truncation helps only expanded mode (`src/ui/components/WordDisplay.tsx:70`).

## Proposed Solutions

### Option 1: Add Focused Performance Characterization Tests/Benchmarks

**Approach:** Add micro-benchmarks or timing assertions for representative token lengths and fallback-heavy cases to establish baseline.

**Pros:**
- Data-driven decision making.
- No behavior change risk.

**Cons:**
- Adds benchmark maintenance overhead.

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Add Lightweight Scan Guardrail for Normal Mode

**Approach:** Cap fallback scan distance or pre-normalize pathological tokens before render.

**Pros:**
- Upper-bounds worst-case work.

**Cons:**
- Potential behavior trade-offs in edge cases.
- May be premature optimization.

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 3: Precompute Pivot Index During Transformation

**Approach:** Store resolved pivot index on transformed words/chunks so render loop does O(1) reads.

**Pros:**
- Removes repeat work from render path.

**Cons:**
- Increases model complexity and data-coupling.
- Likely overkill for current scale.

**Effort:** 5-8 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/ui/components/WordDisplay.tsx`
- Optional benchmark/test files under `tests/ui/`
- Potential transform pipeline files if precompute is chosen

**Related components:**
- RSVP render tick path in `src/ui/screens/RSVPScreen.tsx`
- Chunk/text transform outputs

**Database changes (if any):**
- Migration needed? No
- New columns/tables? None

## Resources

- **PR:** #2
- **Known pattern:** `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
- **Known pattern:** `compound-engineering.local.md`

## Acceptance Criteria

- [ ] Baseline profiling exists for fallback-heavy cases.
- [ ] Team has explicit threshold for acceptable render-loop overhead.
- [ ] If optimization is implemented, behavior contracts remain unchanged.
- [ ] Relevant tests pass.

## Work Log

### 2026-03-11 - Initial Review Capture

**By:** OpenCode

**Actions:**
- Consolidated low-severity performance findings from two review agents.
- Mapped hot-path locations and mitigation options.

**Learnings:**
- Current risk is low but worth tracking before future mode/token complexity increases.

## Notes

- Performance advisory; not merge-blocking at current workload.
