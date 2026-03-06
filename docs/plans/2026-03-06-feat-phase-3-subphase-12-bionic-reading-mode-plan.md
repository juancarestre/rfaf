---
title: "feat: Add Phase 3 Sub-phase 12 Bionic Reading Mode"
type: feat
status: completed
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-12-bionic-mode-brainstorm.md
---

# feat: Add Phase 3 Sub-phase 12 Bionic Reading Mode

## Overview

Found brainstorm from 2026-03-06: `rfaf-phase-3-subphase-12-bionic-mode`. Using it as foundation for planning.

This plan adds a first-class bionic reading mode to rfaf, selectable through the existing `--mode` surface while preserving the same WPM mental model, controls, and session behavior as current RSVP/chunked flows (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-12-bionic-mode-brainstorm.md`).

Additional locked requirement from the brainstorm: ship CLI and agent API parity in the same sub-phase release.

## Problem Statement / Motivation

Chunked mode improves phrase-level comprehension, but some readers still benefit from stronger visual anchors inside words. Sub-phase 12 should introduce bionic emphasis that improves scanability and comprehension without introducing a new interaction model, speed model, or mode-composition complexity (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-12-bionic-mode-brainstorm.md`).

## Research Summary

### Local Research

- Current mode contract only supports `rsvp|chunked`; bionic is not yet accepted by parser/type surface (`src/cli/mode-option.ts:1`).
- Reading pipeline already enforces summarize-first order and mode-specific transform hook, which is the correct insertion point for bionic transforms (`src/cli/reading-pipeline.ts:36`, `src/cli/reading-pipeline.ts:61`).
- UI routing is still single-screen (`RSVPScreen`) with mode prop-driven behavior, so bionic can be integrated as a mode-aware render path without introducing a full screen router yet (`src/ui/App.tsx:14`, `src/ui/screens/RSVPScreen.tsx:305`).
- Word rendering already has deterministic sanitization and pivot highlighting boundaries that bionic emphasis must preserve (`src/ui/components/WordDisplay.tsx:60`, `src/ui/components/WordDisplay.tsx:115`).
- Agent runtime currently transforms words only for chunked mode; bionic parity requires expanding this transform and command/test contracts (`src/agent/reader-api.ts:89`, `tests/agent/reader-api.test.ts:130`).

### Institutional Learnings to Apply

- Keep CLI parsing deterministic and argv-only across all mode values (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Preserve startup/lifecycle cleanup and terminal safety invariants when adding new mode logic (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep explicit Ink layout-axis contracts to avoid centering/alignment regressions while changing word rendering (`docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`).

### External Research Decision

Skipped external research. This sub-phase is an internal mode-contract and rendering evolution with no new third-party API/vendor dependency decisions.

## Proposed Solution

Add `bionic` as an exclusive reading mode in the existing mode system and apply conservative, selective prefix emphasis during rendering so readers gain visual anchors without changing controls, pacing semantics, or summarize flow ordering.

### Mode Contract

- Extend `--mode` allowed values to `rsvp|chunked|bionic`.
- Default remains `rsvp`.
- Mode remains exclusive per run in sub-phase 12 (no mode composition, no runtime multi-mode stack).
- Invalid mode values fail deterministically with usage-style error semantics.

### Bionic Transform Contract

- Bionic transform may reshape token presentation, but only where it improves readability.
- Default policy is conservative prefix emphasis; avoid aggressive full-word mutation.
- Keep token ordering and word count stable for reader/session correctness.
- Very short tokens should generally remain unchanged to avoid visual noise.
- Long or dense tokens are eligible for stronger emphasis within bounded rules.

### Pacing / Control Contract

- WPM remains the canonical speed unit in bionic mode.
- Existing keybindings/help remain unchanged (`Space`, `h/l`, `j/k`, `p/b`, `r`, `?`, `q`).
- Navigation/jump/restart semantics must remain mode-consistent and deterministic.

### Summary Compatibility Contract

- Pipeline order is fixed: input -> optional summarize -> tokenize -> mode transform/render -> playback.
- In `--summary --mode bionic`, bionic transforms are applied to summarized text only.
- Summarization failure remains fail-closed: no playback fallback to original content.

### CLI + Agent Parity Contract

- Any mode visible in CLI must be available through agent runtime surfaces in the same release.
- Agent summarize + bionic flow must preserve summary metadata and mode label parity.
- Mode-switch behavior in agent command path remains explicit and deterministic.

## Technical Considerations

- Prefer additive changes: extend mode enum/resolver and mode transform path rather than introducing a new mode framework.
- Keep existing summarize lazy-load boundary unchanged and insert bionic in current post-tokenize mode path.
- Preserve sanitization guarantees at render boundaries for all transformed text.
- Keep session timing and word-progress accounting tied to stable token counts.
- Keep lifecycle ownership in session wrapper unchanged; mode work must not alter alternate-screen/input cleanup responsibilities.

## System-Wide Impact

- **Interaction graph:** CLI parse -> input resolution -> optional summarize -> tokenize -> mode-specific processing (`rsvp|chunked|bionic`) -> RSVP screen rendering.
- **Error propagation:** invalid bionic mode args are usage failures; summarize/config/runtime failures preserve existing explicit contracts.
- **State lifecycle risks:** transformed display text must not desync reader index/session counters.
- **API surface parity:** agent API command/state/type surfaces expand to include `bionic` in the same release.
- **Integration scenarios:** summary+bionic ordering, control parity, mode-switch behavior, and layout stability under long emphasized words.

## SpecFlow Analysis Integration

SpecFlow gaps addressed in this plan:
- Locked exclusive mode contract with explicit `bionic` extension.
- Locked summarize-before-bionic transform ordering.
- Locked CLI + agent parity as same-release requirement.
- Added deterministic transform constraints to avoid unstable or over-aggressive emphasis.

## Acceptance Criteria

### Functional

- [x] `--mode` supports `rsvp|chunked|bionic` with `rsvp` as default.
- [x] Bionic mode displays conservative prefix emphasis with selective adaptation for longer/denser tokens.
- [x] Bionic mode can be activated with `--summary`.
- [x] In summary+bionic flow, transformations apply to summarized text only.

### UX / Behavior

- [x] Bionic mode preserves existing controls/help behavior and navigation semantics.
- [x] WPM semantics remain consistent across RSVP, chunked, and bionic modes.
- [x] Layout remains centered/stable in common terminal sizes with emphasized text.

### Failure & Contract Semantics

- [x] Invalid `--mode` values fail deterministically with usage-style error.
- [x] Summarization failures still prevent playback start in bionic mode.
- [x] Bionic transform never emits empty display tokens or alters word ordering.

### Agent Parity

- [x] Agent reader runtime accepts and reports `bionic` reading mode.
- [x] Agent `set_reading_mode` supports bionic transitions with stable index mapping.
- [x] Agent summarize command supports `readingMode: "bionic"` with correct summary source labeling.

### Quality Gates (TDD Mandatory)

- [x] Every contract slice is implemented red -> green -> refactor.
- [x] `bun test` passes with zero failures.
- [x] `bun x tsc --noEmit` passes.
- [x] PTY acceptance validation includes bionic startup/controls/summary path checks.

### Execution Notes

- Executed on `feat/bionic-mode-phase3-sub12` using TDD-first flow (red -> green -> refactor).
- Final verification passed: `bun test` (190 pass) and `bun x tsc --noEmit`.

## Testing Strategy (TDD First)

### TDD Sequence

1. Add failing mode-resolver tests for `bionic` acceptance and invalids.
2. Add failing bionic transform tests for selective emphasis policy.
3. Add failing summary+bionic flow tests (CLI and agent parity).
4. Implement minimal mode/transform/render changes to pass each slice.
5. Refactor and re-run full tests + typecheck.

### Planned Test Files

- `tests/cli/mode-args.test.ts`
  - Extend mode parser contract for `bionic`, invalid values, defaults.

- `tests/cli/chunked-cli-contract.test.ts`
  - Split/rename to broader mode contract coverage or add sibling `tests/cli/mode-cli-contract.test.ts` for bionic paths.

- `tests/processor/bionic.test.ts`
  - New unit tests for conservative prefix emphasis, selective adaptation, and stability constraints.

- `tests/cli/summary-chunked-flow.test.ts`
  - Generalize to summary+mode flow coverage or add sibling `tests/cli/summary-bionic-flow.test.ts`.

- `tests/ui/word-display.test.tsx`
  - Add bionic emphasis rendering assertions and sanitization non-regression checks.

- `tests/ui/rsvp-screen-layout.test.ts`
  - Add mode-driven layout stability checks under bionic emphasized output.

- `tests/agent/reader-api.test.ts`
  - Extend for bionic mode switching and summarize+bionic parity checks.

- `docs/validation/2026-03-05-acceptance-pty.md`
  - Add bionic mode startup, controls, resize, and summary+bionic smoke scenarios.

## Suggested Implementation Phases

### Phase A: Contract Lock + Red Tests

- Expand mode enum/parser contract to include `bionic`.
- Add failing tests for CLI + agent parity and bionic transform policy.

### Phase B: Bionic Transform + Render Wiring

- Add bionic transform module and route through existing reading pipeline.
- Add render-path support for emphasized output while preserving layout/sanitization contracts.

### Phase C: Summary and Agent Parity

- Enforce summarize -> bionic ordering in CLI and agent paths.
- Ensure summary labels/metadata remain deterministic with bionic mode.

### Phase D: Hardening + Validation

- Run full TDD matrix, typecheck, and PTY acceptance updates.
- Verify no regressions in lifecycle, parsing determinism, or session accounting.

## Success Metrics

- Users can select bionic mode without relearning controls or speed semantics.
- Bionic emphasis improves readability/comprehension without visual over-intensity.
- Summary+bionic path behaves deterministically and fail-closed.
- CLI and agent reading-mode surfaces remain functionally aligned.

## Dependencies & Risks

- **Risk:** Over-aggressive emphasis reduces readability.
  - **Mitigation:** conservative defaults + explicit transform tests for short/long token behavior.

- **Risk:** Transform text divergence breaks progress/session assumptions.
  - **Mitigation:** enforce stable ordering/count contracts and reader/session regression tests.

- **Risk:** Scope creep into runtime mode-switch redesign.
  - **Mitigation:** keep sub-phase 12 to exclusive mode selection and existing runtime model; defer runtime mode-system redesign to phase 3.14.

- **Risk:** Parity drift between CLI and agent mode surfaces.
  - **Mitigation:** parity acceptance criteria + shared type contract + dedicated agent tests.

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-12-bionic-mode-brainstorm.md`
  - Carried-forward decisions:
    - comprehension-first target at same WPM
    - exclusive mode selection
    - selective token shaping
    - conservative prefix emphasis baseline
    - summary-first ordering
    - same-release CLI + agent parity

### Internal References

- Mode option contract: `src/cli/mode-option.ts:1`
- Reading pipeline ordering/transform hook: `src/cli/reading-pipeline.ts:36`
- App mode handoff: `src/ui/App.tsx:14`
- Mode-sensitive screen state label today: `src/ui/screens/RSVPScreen.tsx:305`
- Word display sanitization + pivot styling: `src/ui/components/WordDisplay.tsx:60`
- Agent mode transform path: `src/agent/reader-api.ts:89`
- Agent parity test baseline: `tests/agent/reader-api.test.ts:130`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### Related Work

- `docs/plans/2026-03-05-feat-phase-3-subphase-11-chunked-reading-mode-plan.md`
- `docs/plans/2026-03-05-feat-phase-2-summarize-then-rsvp-plan.md`
