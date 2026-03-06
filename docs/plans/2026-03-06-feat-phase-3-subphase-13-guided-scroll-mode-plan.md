---
title: "feat: Add Phase 3 Sub-phase 13 Guided Scroll Mode"
type: feat
status: completed
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md
---

# feat: Add Phase 3 Sub-phase 13 Guided Scroll Mode

## Overview

This plan adds guided scroll (`--mode scroll`) as a new reading mode that preserves continuous sentence/paragraph context while auto-advancing line-by-line at WPM-paced speed. It does not expand into runtime mode-switching (deferred to sub-phase 14) or broader mode-system redesign.

Origin brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`.

## Problem Statement / Motivation

Existing modes (`rsvp`, `chunked`, `bionic`) optimize speed and chunk-level comprehension but require readers to mentally reconstruct sentence/paragraph context from isolated word or chunk presentations. Some sessions need stronger continuous context to reduce cognitive context-switching. Guided scroll delivers that outcome while preserving familiar WPM controls and keybindings so existing users can adopt the mode without retraining.

## Research Summary

### Local Research

- Mode contract currently validates `rsvp|chunked|bionic` via `READING_MODES` tuple; scroll needs explicit contract extension (`src/cli/mode-option.ts:3`).
- `resolveReadingMode()` normalizes and validates mode values; adding `"scroll"` to the tuple auto-propagates to CLI validation, type checking, and error messages (`src/cli/mode-option.ts:19`).
- Reading pipeline has clear transform order: input -> optional summarize -> tokenize -> mode transform -> render. Scroll uses pass-through (no word-level transform), same as RSVP (`src/cli/reading-pipeline.ts:36`, `src/cli/reading-pipeline.ts:64`).
- App screen routing currently always renders `RSVPScreen`; scroll needs conditional routing to a new `GuidedScrollScreen` component (`src/ui/App.tsx:16`).
- Reader engine is tick-based (`advancePlayback` increments `currentIndex`); scroll extends this model by deriving a visible line window from `currentIndex` rather than replacing the engine (`src/engine/reader.ts:60`).
- Pacing is WPM-driven with semantic multipliers (sentence-end 3.0x, clause-break 2.0x, paragraph break 4.0x base). Scroll uses the same pacer to compute per-line dwell time as the sum of constituent word durations (`src/processor/pacer.ts:33`).
- Agent API already supports runtime `set_reading_mode` for existing modes; scroll must be included for parity (`src/agent/reader-api.ts:296`).
- `transformWordsForMode()` and `ModeWordCache` in agent API need scroll branches (`src/agent/reader-api.ts:94`).

### Institutional Learnings to Apply

- Keep CLI parsing deterministic and argv-only; avoid environment-dependent interpretation (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Preserve terminal lifecycle ownership and guaranteed cleanup paths in `session-lifecycle.ts` (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Sanitize terminal-rendered user-controlled text via `sanitizeTerminalText` at render boundaries, including CR characters (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep mode state explicit across CLI -> App -> Screen via typed `mode` prop; never infer behavior from display labels (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).
- Prevent layout regressions with explicit Ink `flexDirection` and axis contracts (`docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`).
- Use precomputed lookups for hot render paths (remaining-time calculations), not linear scans (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).

### External Research Decision

Skipped. This is an internal mode evolution with strong local patterns, existing institutional learnings, and no high-risk external integrations.

## Proposed Solution

### Chosen Approach and Rejected Alternatives

- **Chosen:** Focused guided-scroll mode with highlighted-line-in-context rendering, line-by-line advancement, and a dedicated `GuidedScrollScreen` component.
- **Rejected for this sub-phase:**
  - Sliding window (teleprompter-style): less context than highlighted-line-in-context; harder to orient reading position.
  - Full paragraph view (page-turn model): loses the "scroll" feel; too coarse for WPM pacing.
  - Word-by-word smooth scroll: highest complexity for marginal benefit over line-by-line.
  - Extending RSVPScreen with conditional branches: creates coupling that complicates sub-phase 14 runtime mode switching.
  - Comfort-first variant as primary contract: deferred to later tuning once baseline is validated.

### Mode Contract

- CLI value: `scroll`. Display name: "Guided Scroll".
- Add `"scroll"` to the `READING_MODES` tuple in `src/cli/mode-option.ts`. This auto-propagates to CLI validation, `ReadingMode` type, and error messages.
- Keep startup selection as the only CLI activation path in sub-phase 13; CLI runtime mode switching is deferred to sub-phase 14.
- Agent API `set_reading_mode` supports `scroll` for full agent parity (the agent already has runtime switching for existing modes).
- Preserve deterministic usage-style failures for invalid mode values.

### Rendering Model

- **Highlighted line in context:** Display a block of text lines from the input. The current line is visually emphasized (e.g., bold or bright foreground). Surrounding lines are rendered dimmed to provide continuous reading context.
- The visible block fills available terminal height (minus status bar and chrome). On resize, the visible line count adjusts.
- The current-line highlight advances downward through the visible block. When it reaches the bottom, the text block scrolls up to keep the current line centered or near-center.
- At the start, the current line is at the top of the block (no phantom blank lines above).

### Scroll Advancement Model

- **Unit of advancement:** one line. A "line" is a sequence of words that fits within the terminal width at the current text scale.
- **Line computation:** performed at render time (or on resize) by wrapping the `Word[]` array into lines based on terminal column width. This is a precomputed structure, not a per-tick computation.
- **Advancement tick:** the reader engine's `advancePlayback` increments `currentIndex` word by word (unchanged). The screen derives the current line from `currentIndex` by mapping word index to line index via the precomputed line map.
- **Per-line dwell time:** the sum of `getDisplayTime(word, wpm)` for all words on the line. This preserves WPM semantics and semantic multipliers (sentence-end pauses, paragraph breaks) without introducing a new speed concept.
- **Line map invalidation:** on terminal resize, the line map is recomputed. The current word index is preserved, and the new current line is derived from the updated map.

### Step Navigation (When Paused)

- `h` / `l` (step backward / forward): step by one line (the scroll unit), not by one word. This matches the visible advancement unit.
- `p` / `b` (paragraph forward / backward): jump to the first word of the next/previous paragraph, same as existing modes.
- Stepping backward past the first word clamps to index 0. Stepping forward past the last word transitions to `"finished"` state.

### Screen Architecture

- New `GuidedScrollScreen` component in `src/ui/screens/GuidedScrollScreen.tsx`.
- `App.tsx` routes to `GuidedScrollScreen` when `mode === "scroll"`, otherwise renders `RSVPScreen` (which handles `rsvp`, `chunked`, `bionic`).
- `GuidedScrollScreen` receives the same props as `RSVPScreen` (`words`, `initialWpm`, `sourceLabel`, `textScale`, `mode`).
- Keybinding handler shares the same key semantics as RSVPScreen (space, j/k, h/l, p/b, r, ?, q) but `h`/`l` step by line instead of by word.
- Status bar, help overlay, and remaining-time display reuse existing components or follow existing patterns.
- This separation prepares for sub-phase 14 runtime mode switching, where `App.tsx` can swap screen components via a mode state change.

### Pipeline Transform

- Scroll uses pass-through in the reading pipeline (no word-level transform), same as RSVP.
- The pipeline branch at `src/cli/reading-pipeline.ts:64` adds a `"scroll"` case that returns `tokenized` unchanged.
- Line computation and windowing are rendering concerns handled in `GuidedScrollScreen`, not pipeline concerns.

### Agent API Parity

- `transformWordsForMode()` at `src/agent/reader-api.ts:94` adds a `"scroll"` branch that returns words unchanged (pass-through, same as RSVP).
- `ModeWordCache` supports `"scroll"` as a key automatically via `ReadingMode` type extension.
- `set_reading_mode` command at `src/agent/reader-api.ts:296` supports `scroll` with no special handling beyond the pass-through transform.
- `getAgentReaderState()` returns `readingMode: "scroll"` when active.

### Pacing & Controls Contract

- WPM remains the canonical speed unit. No mode-specific speed unit is introduced.
- Speed adjustment (j/k) changes WPM with the same delta and clamping (50-1500) as existing modes.
- Pause/resume (space) freezes/resumes the word-by-word tick advancement.
- Restart (r) resets `currentIndex` to 0 and re-derives the current line.
- Help (?), quit (q), and Ctrl+C behave identically to existing modes.

### Summary Compatibility Contract

- Pipeline order remains locked: input -> optional summarize -> tokenize -> pass-through (scroll) -> playback.
- In combined flows, scroll always renders post-summary text.
- Summary failure behavior remains explicit and deterministic (no silent fallback start; exit non-zero).

### Scope Boundaries (YAGNI)

- No CLI runtime mode-switch framework changes in sub-phase 13 (deferred to sub-phase 14).
- No net-new scroll-only keymap or speculative preferences surface.
- No broad renderer rewrite beyond `GuidedScrollScreen` and its direct dependencies.
- No custom scroll animation or smooth pixel-level scrolling -- line-by-line discrete advancement only.

## Technical Considerations

- Keep mode state explicit across CLI -> App -> Screen via typed `mode: ReadingMode` prop. Never infer behavior from display labels.
- Keep terminal lifecycle invariants centralized in `src/cli/session-lifecycle.ts`. `GuidedScrollScreen` must integrate into the existing cleanup wrapper.
- Ensure `sanitizeTerminalText` is applied to all user-controlled text rendered in `GuidedScrollScreen` (line content, status bar, error messages).
- Precompute the word-index-to-line-index map on mount and on resize. Do not perform linear scans on the word array during render ticks.
- Precompute remaining-time lookup (cumulative duration from each word index to end) following the pattern from chunked mode's remaining-time fix.
- Set `flexDirection` explicitly on all layout-critical Ink containers in `GuidedScrollScreen`. Apply one-concern-per-axis: parent handles vertical placement, child handles horizontal.

## System-Wide Impact

- **Interaction graph:** CLI parse -> mode resolution -> optional summarize -> tokenize -> pass-through -> `GuidedScrollScreen` render -> reader/session control loop.
- **Error propagation:** invalid mode fails as usage error (exit 2); summary/config/runtime errors preserve explicit non-silent failure policy.
- **State lifecycle risks:** line map desync with `currentIndex` on resize or rapid speed changes. Mitigation: recompute line map on resize, derive line position from `currentIndex` (single source of truth).
- **API surface parity:** `set_reading_mode` in agent API supports `scroll` with pass-through transform. No parity gap.
- **Integration test scenarios:** summary+scroll ordering, control parity under playback state changes, resize behavior (line map recomputation), safety cleanup paths, agent `set_reading_mode` to/from scroll.

## SpecFlow Analysis Integration

Spec-flow checks incorporated into this plan:

- Requirement boundary locked (scroll mode addition only; CLI runtime switching deferred to sub-phase 14).
- Contract boundaries locked (CLI mode parsing, pipeline pass-through, line-by-line advancement, control semantics, agent parity).
- Cross-layer risk areas mapped (CLI parsing, pipeline transform order, screen routing, line map computation, UI layout stability, terminal lifecycle, agent API parity).
- Architectural decisions resolved (rendering model, scroll unit, engine approach, screen component, pipeline transform, agent scope, CLI value, step navigation).
- Edge-case expectations promoted into acceptance criteria and TDD gates.

## Acceptance Criteria

### Functional Requirements

- [x] CLI supports `--mode scroll` with deterministic parse behavior and stable defaults.
- [x] `--mode scroll` is documented in `--help` output alongside `rsvp`, `chunked`, `bionic`.
- [x] Guided scroll renders a text block with the current line highlighted and surrounding lines dimmed.
- [x] Line computation respects terminal width and text scale; lines recompute on resize.
- [x] Guided scroll advances line-by-line, with per-line dwell time equal to the sum of constituent word durations via `getDisplayTime`.
- [x] Guided scroll can run with `--summary`, and the pipeline order is summary-before-tokenize-before-pass-through.
- [x] Guided scroll preserves content integrity (no dropped or duplicated words across the full word array).

### UX / Behavior Requirements

- [x] WPM remains the speed contract. Speed changes (j/k) feel proportional and consistent with other modes.
- [x] Control parity: pause/resume (space), speed +/- (j/k), paragraph nav (p/b), restart (r), help (?), quit (q) all work.
- [x] Step forward/backward (l/h) advances by one line when paused.
- [x] Display remains vertically centered and stable in common terminal sizes (80x24, 120x40).
- [x] Current-line highlight is visually clear and distinguishable from context lines.
- [ ] Reading experience feels natural at typical WPM (200-350) for continuous-context reading.

### Failure & Contract Semantics

- [x] Invalid mode values (e.g., `--mode invalid`) fail deterministically with usage-style output and exit code 2.
- [x] Startup/runtime failures restore terminal state (cursor, alternate screen, raw mode).
- [x] Sanitization is applied to all user-controlled render surfaces and tested against ANSI/OSC/CR payloads.
- [x] Summary failures prevent playback start under scroll mode (exit non-zero, no silent fallback).

### Agent Parity

- [x] `set_reading_mode` accepts `"scroll"` and applies pass-through transform.
- [x] `getAgentReaderState()` returns `readingMode: "scroll"` when scroll mode is active.
- [x] Agent can switch to/from scroll mode at runtime with correct word transform and progress preservation.

### Quality Gates (TDD-First Mandatory)

- [x] Each contract slice follows red -> green -> refactor before advancing.
- [x] Tests for contracts are authored before implementation for CLI, pipeline, screen, and agent slices.
- [x] `bun test` passes with zero failures.
- [x] `bun x tsc --noEmit` passes.
- [ ] PTY validation includes scroll startup, controls, resize, and cleanup checks.

## Testing Strategy (TDD First)

### TDD Sequence

1. Write failing CLI mode-contract tests for `scroll` parsing and invalid-value behavior.
2. Write failing line-computation tests for deterministic word-to-line mapping, resize recomputation, and content integrity.
3. Write failing pacing tests for per-line dwell time calculation from WPM.
4. Write failing integration tests for summary+scroll ordering and no-fallback behavior.
5. Write failing UI/layout tests for `GuidedScrollScreen` stability, centering, highlight rendering, and control parity.
6. Write failing agent API tests for `set_reading_mode` scroll parity and state projection.
7. Implement minimum code slice-by-slice until green.
8. Refactor with full suite + typecheck + PTY validation reruns.

### Planned Test Files

- `tests/cli/scroll-mode-args.test.ts`
  - Parse `--mode scroll`, defaults, invalid values, argv-only determinism. Extends mode validation coverage alongside existing `tests/cli/mode-args.test.ts` patterns.

- `tests/cli/scroll-cli-contract.test.ts`
  - End-to-end mode activation, usage failures, coexistence with `--summary`, `--wpm`, `--text-scale`.

- `tests/processor/line-computation.test.ts`
  - Word-to-line mapping: terminal width boundary, long words, empty input, single word. Resize recomputation preserves current word. Content integrity: every word appears exactly once across all lines.

- `tests/processor/scroll-line-pacer.test.ts`
  - Per-line dwell time equals sum of `getDisplayTime` for constituent words. Sentence-end and paragraph multipliers correctly affect line timing.

- `tests/cli/summary-scroll-flow.test.ts`
  - Enforce summary -> tokenize -> pass-through ordering. Summary failure prevents playback start.

- `tests/ui/guided-scroll-screen-layout.test.tsx`
  - Vertical centering with explicit `flexDirection`. Current-line highlight renders correctly. Surrounding lines are dimmed. Resize triggers line map update.

- `tests/ui/guided-scroll-controls.test.tsx`
  - Keybinding parity: space (pause/resume), j/k (speed), h/l (step by line), p/b (paragraph), r (restart), ? (help), q (quit).

- `tests/cli/scroll-terminal-safety.test.ts`
  - Sanitization via `sanitizeTerminalText` on rendered lines. Startup failure cleanup. Quit/Ctrl+C terminal restoration.

- `tests/agent/reader-api-scroll-parity.test.ts`
  - `set_reading_mode` to `"scroll"` applies pass-through transform. State projection returns `readingMode: "scroll"`. Mode switch preserves progress ratio. Round-trip: rsvp -> scroll -> rsvp.

- `docs/validation/2026-03-06-guided-scroll-acceptance-pty.md`
  - PTY command transcripts for: startup with `--mode scroll`, pause/resume, speed adjustment, step by line, paragraph navigation, `--summary` combined flow, resize behavior, quit and Ctrl+C cleanup.

## Suggested Implementation Phases

### Phase A: Contract Lock + Red Tests

- Add `"scroll"` to `READING_MODES` tuple in `src/cli/mode-option.ts`.
- Add failing tests for mode parsing, line computation, and per-line pacing contracts.
- Add failing agent API parity tests for scroll.

### Phase B: Line Computation + GuidedScrollScreen Scaffold

- Implement word-to-line mapping (precomputed on mount, recomputed on resize).
- Create `GuidedScrollScreen` component with highlighted-line-in-context rendering.
- Add screen routing in `App.tsx` (`mode === "scroll"` -> `GuidedScrollScreen`).
- Wire reader engine tick to line advancement (derive current line from `currentIndex`).

### Phase C: Controls + Pacing + Agent Parity

- Implement keybinding handler in `GuidedScrollScreen` with line-step semantics for h/l.
- Implement per-line dwell time calculation (sum of constituent word durations).
- Add pass-through branch in `transformWordsForMode()` and pipeline for scroll.
- Validate precomputed remaining-time lookups.

### Phase D: Summary Compatibility + Safety Hardening

- Validate summary-before-scroll ordering in integration tests.
- Apply `sanitizeTerminalText` to all rendered line content.
- Validate terminal lifecycle cleanup for scroll mode startup failures.
- Verify `RFAF_NO_ALT_SCREEN=1` test mode works with `GuidedScrollScreen`.

### Phase E: Validation + Documentation

- Complete PTY acceptance transcripts for scroll mode.
- Add scroll section to `docs/validation/2026-03-05-acceptance-pty.md`.
- Update `--help` descriptions if needed (auto-derived from tuple, but verify).
- Update any mode-reference documentation.

## Success Metrics

- Users can adopt scroll mode without relearning core controls.
- Scroll mode feels natural at typical WPM (200-350) for continuous-context reading.
- Summary+scroll flows behave deterministically.
- Agent API has full parity with CLI for scroll mode.
- No regressions in terminal safety, deterministic CLI behavior, or layout stability across existing modes.

## Dependencies & Risks

- **Risk:** Scope creep into runtime mode switching or mode framework redesign.
  - **Mitigation:** Enforce startup-selectable-only boundary for sub-phase 13. Runtime switching is sub-phase 14.

- **Risk:** Line computation produces inconsistent results across terminal widths or text scales.
  - **Mitigation:** Define deterministic line-wrapping algorithm with explicit test cases for boundary conditions (long words, narrow terminals, text scale factors).

- **Risk:** Line-by-line step navigation feels sluggish on very long lines or very short lines.
  - **Mitigation:** Accept this for MVP. Tuning step granularity is a follow-up concern, not a sub-phase 13 scope item.

- **Risk:** Render hot-path performance degradation on long inputs (large word arrays, frequent line map lookups).
  - **Mitigation:** Precompute word-index-to-line-index map and cumulative remaining-time array. Profile if word count exceeds 10,000.

- **Risk:** Terminal state leakage on failure paths.
  - **Mitigation:** Keep `session-lifecycle.ts` ownership of terminal restoration. Add PTY cleanup assertions for scroll mode.

- **Risk:** Line map desync with currentIndex on rapid resize events.
  - **Mitigation:** Recompute line map synchronously on resize. Derive line from `currentIndex` (single source of truth, never store line index independently).

- **Risk:** Agent parity drift if `set_reading_mode` handler doesn't account for scroll's pass-through semantics.
  - **Mitigation:** Dedicated agent parity test file with round-trip mode switching assertions.

## Open Questions Status

- All architectural decisions resolved during planning:
  - Rendering model: highlighted line in context.
  - Scroll unit: line-by-line.
  - Engine approach: extend existing reader (derive line from currentIndex).
  - Screen architecture: new GuidedScrollScreen component.
  - Pipeline transform: pass-through.
  - Agent parity: full (set_reading_mode supports scroll).
  - CLI value: `scroll`.
  - Step navigation: step by line.
- No open questions remain.

## AI-Era Notes

- Use AI pair-programming to accelerate test matrix authoring, but require human review of terminal safety and lifecycle boundaries.
- Preserve TDD-first discipline despite acceleration pressure; no implementation slice starts before failing contract tests exist.

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`
  - Carried-forward decisions:
    - continuous-context primary outcome
    - WPM-driven auto-scroll pacing
    - strong control parity
    - startup-selectable-only scope for sub-phase 13
    - natural-feel success criterion at target WPM
    - mandatory TDD-first quality gate
    - YAGNI scope discipline

### Internal References

- Mode option contract (READING_MODES tuple): `src/cli/mode-option.ts:3`
- Mode resolver: `src/cli/mode-option.ts:19`
- CLI mode option definition: `src/cli/index.tsx:189`
- Reading pipeline transform order: `src/cli/reading-pipeline.ts:36`
- Pipeline mode-specific branch: `src/cli/reading-pipeline.ts:64`
- App screen routing: `src/ui/App.tsx:16`
- RSVPScreen controls baseline: `src/ui/screens/RSVPScreen.tsx:210`
- Reader engine: `src/engine/reader.ts:60`
- Pacer (WPM + semantic multipliers): `src/processor/pacer.ts:33`
- Agent API transform: `src/agent/reader-api.ts:94`
- Agent API set_reading_mode: `src/agent/reader-api.ts:296`

### Institutional Learnings

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### Related Work

- `docs/plans/2026-03-05-feat-phase-3-subphase-11-chunked-reading-mode-plan.md`
- `docs/validation/2026-03-05-acceptance-pty.md`
- `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
