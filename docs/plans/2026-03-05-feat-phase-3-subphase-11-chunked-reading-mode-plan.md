---
title: "feat: Add Phase 3 Sub-phase 11 Chunked Reading Mode"
type: feat
status: completed
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md
---

# feat: Add Phase 3 Sub-phase 11 Chunked Reading Mode

## Overview

Found brainstorm from 2026-03-05: `rfaf-phase-3-subphase-11-chunked-mode`. Using it as foundation for planning.

This plan adds a focused chunked reading mode (adaptive 3-5 word groups) to rfaf with comprehension-first behavior while preserving existing WPM controls and keyboard parity (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`).

Additional requirement carried into this plan: chunked mode must work with `--summary` flow, using summarized text as the chunking source.

## Problem Statement / Motivation

Single-word RSVP is fast but can reduce context retention for some reading tasks. Phase 3 sub-phase 11 should provide a chunked alternative that improves comprehension without introducing broad mode-system complexity (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`).

## Research Summary

### Local Research

- Current runtime is single-mode (`App -> RSVPScreen`) with no mode router (`src/cli/index.tsx:256`, `src/ui/App.tsx:12`).
- Tokenization already carries punctuation/paragraph metadata useful for chunk boundaries (`src/processor/tokenizer.ts:59`, `src/processor/types.ts:12`).
- Existing pacing and controls are WPM-based and heavily tested; preserving this model minimizes user retraining (`src/processor/pacer.ts:33`, `src/ui/screens/RSVPScreen.tsx:166`).
- Summary pipeline currently happens before tokenization and must remain before mode-specific transforms (`src/cli/index.tsx:239`, `src/cli/summarize-flow.ts:23`).

### Institutional Learnings to Apply

- Keep CLI parsing deterministic and argv-only (no filesystem-dependent interpretation) (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Preserve terminal lifecycle and sanitization boundaries (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Use explicit Ink axis contracts to avoid vertical centering regressions (`docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`).

### External Research Decision

Skipped external research. This feature is internal architecture + UX evolution with strong local patterns and no new external API/vendor dependencies.

## Proposed Solution

Add a new chunked mode selectable via CLI mode flag, reusing current engine/session/control semantics wherever possible.

### Mode Contract

- Introduce `--mode` with allowed values `rsvp|chunked`.
- Default remains `rsvp`.
- Chunked mode is entry-only via CLI for this sub-phase (no runtime mode switching in this step) (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`).
- Invalid `--mode` values return usage-style failure (deterministic error semantics).

### Chunking Contract

- Chunk output targets adaptive 3-5 words.
- Adaptation uses punctuation and natural phrase boundaries from tokenizer metadata.
- Tail behavior is deterministic and test-defined (no empty chunks, no dropped words).
- Chunked mode prioritizes comprehension over maximum throughput (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`).

### Pacing & Controls Contract

- WPM remains canonical speed unit in chunked mode (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`).
- Existing keybindings/help remain the same (`Space`, `h/l`, `j/k`, `p/b`, `r`, `?`, `q`).
- Step/jump/restart behavior preserves current pause and navigation semantics.

### `--summary` Compatibility Contract

- Pipeline order is fixed: input -> optional summarize -> tokenize -> chunk transform -> playback.
- In `--summary --mode chunked`, chunking always runs on summarized text, never pre-summary source text.
- If summarize fails, playback does not start (preserve existing no-fallback summary contract).

## Technical Considerations

- Prefer additive architecture over broad refactor: mode resolver + mode-specific processing path + chunked screen.
- Keep summary flow lazy-load behavior and deterministic CLI parsing guarantees.
- Keep rendering text sanitized at output boundaries.
- Keep terminal lifecycle ownership in session-lifecycle path unchanged.
- Preserve agent parity expectations: if mode is user-visible via CLI, agent API parity must be explicitly decided in implementation and tests.

## System-Wide Impact

- **Interaction graph:** CLI parse -> input resolution -> optional summarize -> tokenize -> mode-specific transform (`rsvp` or `chunked`) -> render screen.
- **Error propagation:** invalid mode is usage failure; summarize/config/runtime failures preserve existing explicit failure contracts.
- **State lifecycle risks:** chunked timing and navigation must not desync reader/session counters.
- **API surface parity:** new mode visibility should be reflected in agent command/state plan or explicitly deferred with rationale.
- **Integration scenarios:** summary+chunked ordering, keybinding parity, timing behavior under speed changes.

## SpecFlow Analysis Integration

SpecFlow gaps addressed in this plan:
- Locked mode contract (`--mode=rsvp|chunked`, default `rsvp`).
- Locked transform ordering with summary compatibility.
- Added deterministic failure handling expectations for invalid mode and empty outputs.
- Added explicit pacing/control parity requirements for chunked mode.

## Acceptance Criteria

### Functional

- [x] `--mode` supports `rsvp|chunked` with `rsvp` as default.
- [x] Chunked mode renders adaptive 3-5 word groups for normal text flow.
- [x] Chunked mode can be activated alongside `--summary`.
- [x] In summary+chunked flow, chunking is applied to summarized text only.

### UX / Behavior

- [x] Chunked mode preserves existing keybindings/help text expectations.
- [x] WPM semantics remain consistent between RSVP and chunked modes.
- [x] Chunked display remains centered/stable in common terminal dimensions.

### Failure & Contract Semantics

- [x] Invalid `--mode` values fail deterministically with usage-style error.
- [x] Summary failures still prevent playback start in chunked mode.
- [x] Chunking never emits empty chunks or drops words.

### Quality Gates (TDD Mandatory)

- [x] Every contract slice is implemented with red -> green -> refactor.
- [x] `bun test` passes with zero failures.
- [x] `bun x tsc --noEmit` passes.
- [x] PTY validation is updated with chunked-mode checks.

## Testing Strategy (TDD First)

### TDD Sequence

1. Write failing CLI mode-arg resolver tests.
2. Write failing chunker unit tests for adaptive boundaries and tails.
3. Write failing summary+chunked flow integration tests.
4. Implement minimum code to pass each slice.
5. Refactor and re-run full suite + typecheck.

### Planned Test Files

- `tests/cli/mode-args.test.ts`
  - Mode parsing, defaults, invalid values, deterministic argv semantics.

- `tests/cli/chunked-cli-contract.test.ts`
  - End-to-end mode activation, usage errors, non-regression with existing flags.

- `tests/processor/chunker.test.ts`
  - Adaptive 3-5 grouping, punctuation boundary behavior, tail handling.

- `tests/processor/chunked-pacer.test.ts`
  - WPM-based chunk dwell behavior and speed adjustment consistency.

- `tests/cli/summary-chunked-flow.test.ts`
  - Enforce summarize -> tokenize -> chunk transform ordering and no-fallback semantics.

- `tests/ui/chunked-screen-layout.test.tsx`
  - Centering/layout stability and render contract for chunk output.

- `tests/ui/chunked-controls.test.tsx`
  - Keybinding parity with RSVP mode.

- `tests/agent/reader-api.test.ts`
  - Mode parity expectations (or explicit deferral test/documentation check).

- `docs/validation/2026-03-05-acceptance-pty.md`
  - Add chunked mode startup, resize, controls, and summary+chunked smoke paths.

## Suggested Implementation Phases

### Phase A: Contract Lock + Red Tests

- Lock `--mode` CLI contract and invalid-value behavior.
- Add failing tests for mode parsing and chunker behavior.

### Phase B: Chunk Transform + Playback Path

- Add chunking transform and mode path in app/screen flow.
- Preserve WPM/control semantics.

### Phase C: Summary Compatibility + Hardening

- Integrate chunked mode with summary pipeline ordering.
- Ensure deterministic errors and lifecycle/sanitization invariants.

### Phase D: Validation + Docs

- Complete full TDD suite and PTY checks.
- Update docs/help references for mode usage.

## Success Metrics

- Users can switch to chunked mode without relearning controls.
- Chunked mode improves readability/comprehension without breaking speed workflow.
- Summary+chunked flow works deterministically and safely.
- No regression in lifecycle, sanitization, or CLI determinism.

## Dependencies & Risks

- **Risk:** Scope creep into mode-switching system redesign.
  - **Mitigation:** Keep CLI-entry-only in sub-phase 11; defer runtime switching to Phase 3 item 14.

- **Risk:** Timing semantics drift between RSVP and chunked modes.
  - **Mitigation:** WPM mapping tests and contract-level pacing assertions.

- **Risk:** UI alignment regressions for larger chunk text.
  - **Mitigation:** explicit layout-axis contracts + dedicated chunked layout tests.

- **Risk:** Summary integration order bugs.
  - **Mitigation:** explicit integration tests for summary-before-chunk ordering.

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`
  - Carried-forward decisions:
    - comprehension-first outcome
    - adaptive 3-5 chunk sizing
    - WPM semantics preserved
    - CLI flag activation in this sub-phase
    - control parity and YAGNI scope limits

### Internal References

- Current CLI flow + summary ordering: `src/cli/index.tsx:239`
- Summary runtime boundary: `src/cli/summarize-flow.ts:23`
- Single-mode app routing today: `src/ui/App.tsx:12`
- Existing reader controls: `src/ui/screens/RSVPScreen.tsx:166`
- Tokenization metadata for chunk boundaries: `src/processor/tokenizer.ts:59`
- Pacing semantics baseline: `src/processor/pacer.ts:33`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### Related Work

- `docs/plans/2026-03-05-feat-phase-2-summarize-then-rsvp-plan.md`
- `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
