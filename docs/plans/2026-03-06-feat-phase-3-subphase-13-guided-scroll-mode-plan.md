---
title: "feat: Add Phase 3 Sub-phase 13 Guided Scroll Mode"
type: feat
status: active
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md
---

# feat: Add Phase 3 Sub-phase 13 Guided Scroll Mode

## Overview

Found brainstorm from 2026-03-06: `rfaf-phase-3-subphase-13-guided-scroll-mode`. Using as foundation for planning.

This plan adds guided scroll as a focused new reading mode that preserves continuous sentence/paragraph context while auto-advancing by WPM, without expanding into runtime mode-switching or broader mode-system redesign (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).

## Problem Statement / Motivation

Current modes optimize speed and chunk-level comprehension, but some sessions need stronger continuous context to reduce cognitive context-switching. Sub-phase 13 should deliver that outcome while preserving familiar controls and speed semantics so existing users can adopt the mode without retraining (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).

## Research Summary

### Local Research

- Mode contract currently validates `rsvp|chunked`; guided scroll needs explicit contract extension and deterministic invalid-value behavior (`src/cli/mode-option.ts:1`, `src/cli/mode-option.ts:19`).
- Reading flow already has clear transform order and should remain stable: input -> optional summarize -> tokenize -> mode transform -> render (`src/cli/reading-pipeline.ts:36`, `src/cli/reading-pipeline.ts:61`).
- App/screen routing and controls are centralized, enabling strong control-parity planning (`src/ui/App.tsx:16`, `src/ui/screens/RSVPScreen.tsx:210`, `src/engine/reader.ts:60`).
- Pacing baseline is WPM-driven with semantic multipliers and should remain canonical (`src/processor/pacer.ts:33`).

### Institutional Learnings to Apply

- Keep CLI parsing deterministic and argv-only; avoid environment-dependent interpretation (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Preserve terminal lifecycle ownership and guaranteed cleanup paths (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Sanitize terminal-rendered user-controlled text at boundaries (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Keep mode state explicit across layers and avoid coupling behavior to labels (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).
- Prevent layout regressions with explicit Ink axis contracts (`docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`).

### External Research Decision

Skipped external research. This work is an internal mode evolution with strong local patterns, existing institutional learnings, and no high-risk external integrations.

## Proposed Solution

### Chosen Approach and Rejected Alternatives

- **Chosen:** Focused guided-scroll mode MVP (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- **Rejected for this sub-phase:**
  - Comfort-first variant as primary contract: deferred to later tuning once baseline mode behavior is validated.
  - Explicit beta contract framing: not required now because scope is already narrow and acceptance criteria are strict.

### Mode Contract

- Add guided scroll as a startup-selectable mode in CLI mode options.
- Keep startup selection as the only activation path in sub-phase 13; runtime mode switching remains out of scope (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- Preserve deterministic usage-style failures for invalid mode values.

### Guided Scroll Behavior Contract

- Primary outcome is continuous-context reading, not maximum burst speed (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- Auto-scroll behavior is paced by the same WPM mental model as other modes (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- Scrolling progression and segment boundaries must be deterministic and test-defined (no dropped or duplicated content windows).

### Pacing & Controls Contract

- WPM remains the canonical speed unit; no mode-specific speed unit is introduced (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- Strong control parity is required: pause/resume, speed adjustment, paragraph navigation, restart/help/quit semantics remain aligned with existing mode expectations (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- Navigation and playback interactions must preserve current pause/step consistency guarantees from reader/session logic.

### Summary Compatibility Contract

- Pipeline order remains locked: input -> optional summarize -> tokenize -> guided-scroll transform -> playback.
- In combined flows, guided scroll always consumes post-summary text.
- Summary failure behavior remains explicit and deterministic (no silent fallback start).

### Scope Boundaries (YAGNI)

- No runtime mode-switch framework changes in sub-phase 13 (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- No net-new guided-scroll-only keymap or speculative preferences surface in this phase (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- No broad renderer rewrite beyond what is required for guided-scroll contract compliance.

## Technical Considerations

- Keep mode state explicit across CLI -> App -> Screen and do not infer behavior from display labels.
- Keep terminal lifecycle invariants centralized in session lifecycle boundaries.
- Ensure output sanitization remains enforced in render/status/error surfaces.
- Protect hot paths with precomputed structures where needed to avoid render-time linear scans on large text.
- Explicitly decide agent-surface parity for guided scroll in this plan cycle (include or defer with rationale).

## System-Wide Impact

- **Interaction graph:** CLI parse -> mode resolution -> optional summarize -> tokenize -> guided-scroll transform -> screen render -> reader/session control loop.
- **Error propagation:** invalid mode and invalid contracts fail as usage errors; summarize/config/runtime errors preserve explicit non-silent failure policy.
- **State lifecycle risks:** auto-scroll position, reader index, and paragraph navigation may desync under speed/resize/control events if contracts are implicit.
- **API surface parity:** CLI-visible mode must have explicit parity decision for agent-facing reader API surfaces.
- **Integration test scenarios:** summary+guided-scroll ordering, control parity under playback state changes, resize behavior, and safety cleanup paths.

## SpecFlow Analysis Integration

Spec-flow checks incorporated into this plan:

- Requirement boundary locked (guided-scroll mode addition only; no runtime switching).
- Contract boundaries locked (CLI mode parsing, pipeline order, deterministic failures, control semantics).
- Cross-layer risk areas mapped (CLI parsing, pipeline transform order, UI layout stability, terminal lifecycle, agent parity).
- Edge-case expectations promoted into acceptance criteria and TDD gates.

## Acceptance Criteria

### Functional Requirements

- [ ] CLI supports guided-scroll as an explicit mode option with deterministic parse behavior and stable defaults.
- [ ] Guided scroll renders continuous-context progression appropriate for sentence/paragraph flow (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- [ ] Guided scroll can run with `--summary`, and the transform order is summary-before-guided-scroll.
- [ ] Guided scroll preserves content integrity (no dropped or duplicated reading segments across full input).

### UX / Behavior Requirements

- [ ] WPM remains the speed contract for guided scroll (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- [ ] Control parity is preserved for pause/resume, speed +/-, paragraph navigation, restart/help/quit (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).
- [ ] Guided-scroll display remains stable and centered in common terminal sizes.
- [ ] Reading experience feels natural at target WPM (primary success criterion from brainstorm).

### Failure & Contract Semantics

- [ ] Invalid mode values fail deterministically with usage-style output.
- [ ] Startup/runtime failures still restore terminal state (cursor/alternate screen/raw mode safety).
- [ ] Sanitization is applied to user-controlled render surfaces and tested against ANSI/OSC/CR payloads.
- [ ] Summary failures prevent playback start under guided-scroll mode.

### Quality Gates (TDD-First Mandatory)

- [ ] Each contract slice follows red -> green -> refactor before advancing.
- [ ] Tests for contracts are authored before implementation for CLI, pipeline, processor, UI, and integration slices.
- [ ] `bun test` passes with zero failures.
- [ ] `bun x tsc --noEmit` passes.
- [ ] PTY validation includes guided-scroll startup, controls, resize, and cleanup checks.
- [ ] Agent parity decision is documented and validated (implemented or explicitly deferred with rationale + guard tests).

## Testing Strategy (TDD First)

### TDD Sequence

1. Write failing CLI mode-contract tests for guided scroll parsing and invalid-value behavior.
2. Write failing guided-scroll transform/pacing tests for deterministic progression and integrity.
3. Write failing integration tests for summary+guided-scroll ordering and no-fallback behavior.
4. Write failing UI/layout tests for stability/centering/control parity.
5. Implement minimum code slice-by-slice until green.
6. Refactor with full suite + typecheck + PTY validation reruns.

### Planned Test Files

- `tests/cli/guided-scroll-args.test.ts`
  - Parse forms, defaults, invalid values, argv-only determinism.

- `tests/cli/guided-scroll-cli-contract.test.ts`
  - End-to-end mode activation, usage failures, coexistence with current flags.

- `tests/processor/guided-scroll-transform.test.ts`
  - Deterministic segmenting/progression, no dropped/duplicated content windows.

- `tests/processor/guided-scroll-pacer.test.ts`
  - WPM mapping behavior and speed adjustment consistency.

- `tests/cli/summary-guided-scroll-flow.test.ts`
  - Enforce summary -> tokenize -> guided-scroll transform ordering and failure semantics.

- `tests/ui/guided-scroll-screen-layout.test.tsx`
  - Centering, axis stability, and resize behavior.

- `tests/ui/guided-scroll-controls.test.tsx`
  - Keybinding/control parity with existing expectations.

- `tests/cli/guided-scroll-terminal-safety.test.ts`
  - Sanitization, startup failure cleanup, quit/Ctrl+C cleanup behavior.

- `tests/agent/reader-api-guided-scroll-parity.test.ts`
  - Parity behavior (implemented) or explicit parity-deferral contract.

- `docs/validation/2026-03-06-guided-scroll-acceptance-pty.md`
  - PTY command transcripts for startup, controls, summary flow, resize, and cleanup.

## Suggested Implementation Phases

### Phase A: Contract Lock + Red Tests

- Lock CLI mode contract and deterministic failure semantics.
- Add failing tests for mode parsing and core guided-scroll progression contracts.

### Phase B: Guided Scroll Path + Control Parity

- Introduce guided-scroll mode path in app/screen flow.
- Preserve WPM semantics and control parity behaviors.

### Phase C: Summary Compatibility + Safety Hardening

- Validate summary-before-guided-scroll ordering.
- Validate terminal sanitization and lifecycle invariants for new mode.

### Phase D: Validation + Documentation

- Complete PTY acceptance and regression checks.
- Update mode/help/plan references and parity decision notes.

## Success Metrics

- Users can adopt guided scroll without relearning core controls.
- Guided scroll is perceived as natural at target WPM for continuous-context reading.
- Summary+guided-scroll flows behave deterministically.
- No regressions in terminal safety, deterministic CLI behavior, or layout stability.

## Dependencies & Risks

- **Risk:** Scope creep into runtime mode switching or mode framework redesign.
  - **Mitigation:** Enforce startup-selectable-only boundary for sub-phase 13 (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-13-guided-scroll-mode-brainstorm.md`).

- **Risk:** Continuous-scroll behavior conflicts with existing word/paragraph token model.
  - **Mitigation:** Define deterministic transform contract and test for content integrity and navigation parity.

- **Risk:** Render hot-path performance degradation on long inputs.
  - **Mitigation:** Require precomputed lookup strategy where needed; include regression checks.

- **Risk:** Terminal state leakage on failure paths.
  - **Mitigation:** Keep lifecycle wrapper ownership and add PTY cleanup assertions.

- **Risk:** API parity drift between CLI and agent interfaces.
  - **Mitigation:** Include explicit parity decision and dedicated contract test.

## Open Questions Status

- No open questions remain from the origin brainstorm.
- This plan resolves planning handoff requirements by formalizing contracts, TDD gates, and validation surfaces.

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

- Mode option contract baseline: `src/cli/mode-option.ts:1`
- CLI mode resolution path: `src/cli/index.tsx:189`
- Reading pipeline order: `src/cli/reading-pipeline.ts:36`
- App screen routing baseline: `src/ui/App.tsx:16`
- Control input semantics baseline: `src/ui/screens/RSVPScreen.tsx:210`
- Reader/session behavior semantics: `src/engine/reader.ts:60`
- Pacing baseline: `src/processor/pacer.ts:33`

### Institutional Learnings

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### Related Work

- `docs/plans/2026-03-05-feat-phase-3-subphase-11-chunked-reading-mode-plan.md`
- `docs/validation/2026-03-05-acceptance-pty.md`
- `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
