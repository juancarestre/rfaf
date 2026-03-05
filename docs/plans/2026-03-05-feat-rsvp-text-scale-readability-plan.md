---
title: "feat: Add RSVP Text Scale Readability Controls"
type: feat
status: completed
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md
---

# feat: Add RSVP Text Scale Readability Controls

## Overview

Found brainstorm from 2026-03-05: `rfaf-phase-1-2-text-scale`. This plan uses it as foundation.

Add a Phase 1.2 readability improvement for rfaf by introducing `--text-scale` and increasing default readability so text is easier to read out of the box (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).

This remains a focused MVP-adjacent enhancement: no new reading modes, no numeric scaling model, and no `--font-size` alias in this phase (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).

## Problem Statement / Motivation

Current terminal presentation is perceived as too small for comfortable reading. That reduces usability of the core RSVP experience, especially during longer sessions.

The improvement goal is practical readability in terminal constraints: rfaf can control text emphasis/spacing/layout, not the host terminal's actual font size (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).

## Research Summary

### Local Research (Always-on)

- **Repo patterns found:**
  - CLI options/validation are centralized in `src/cli/index.tsx:99`.
  - Existing validation style is explicit parse helpers + clear error strings (e.g., `--wpm`) in `src/cli/index.tsx:86`.
  - Core readability surfaces are `src/ui/components/WordDisplay.tsx:45`, `src/ui/components/StatusBar.tsx:18`, and `src/ui/components/HelpOverlay.tsx:3` (composed in `src/ui/screens/RSVPScreen.tsx:250`).
  - Existing UI testing style favors helper-focused tests and render-to-string assertions (`tests/ui/word-display.test.tsx:7`, `tests/ui/status-bar.test.tsx:6`).

- **Institutional learnings applied:**
  - Preserve terminal lifecycle safety in `src/cli/session-lifecycle.ts:18`.
  - Keep sanitization at render boundaries via `src/ui/sanitize-terminal-text.ts:5`.
  - Maintain deterministic CLI behavior and avoid scope creep (see `compound-engineering.local.md:8`).
  - Use PTY validation patterns from `docs/validation/2026-03-05-acceptance-pty.md`.

### External Research Decision

Skipped external research. This is low-risk, internally well-understood work with strong existing code patterns and recent institutional docs for the same terminal/UI area.

## Proposed Solution

Implement app-level text scaling with a new CLI flag `--text-scale` and stronger default readability (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).

### Behavior Contract

- Supported presets: `small`, `normal`, `large` (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).
- Default: increased readability vs current baseline (default will be tuned in implementation to satisfy acceptance checks).
- Scope: core reading surfaces only in Phase 1.2:
  - RSVP word lane (primary)
  - status readability alignment
  - help overlay readability alignment
- Out of scope:
  - OS terminal font control
  - numeric multipliers
  - `--font-size` alias
  - new reading modes

## Technical Considerations

- **CLI parsing:** Add `--text-scale` in yargs flow next to `--wpm` (`src/cli/index.tsx:106`) with preset validation and help text.
- **Validation semantics:** keep deterministic error behavior aligned with existing flag validation conventions (`src/cli/index.tsx:86`, `src/cli/index.tsx:179`).
- **Rendering boundaries:** retain sanitization guarantees while applying scale (`src/ui/sanitize-terminal-text.ts:5`).
- **Terminal constraints:** scaling must degrade gracefully on narrow terminals; preserve small-terminal guard behavior (`src/ui/screens/RSVPScreen.tsx:106`).
- **Performance/safety non-regression:** no changes to lifecycle wrapper semantics in `src/cli/session-lifecycle.ts:18`.

## System-Wide Impact

- **Interaction graph:** CLI arg parsing in `src/cli/index.tsx` determines runtime scale preset -> passed to App/RSVP screen props -> applied in WordDisplay/StatusBar/HelpOverlay rendering. Existing terminal lifecycle wrapper still governs app start/exit (`src/cli/session-lifecycle.ts:18`).
- **Error propagation:** invalid `--text-scale` should fail in argument validation path and surface clear stderr messages with predictable exit behavior, consistent with existing validation flow (`src/cli/index.tsx:179`).
- **State lifecycle risks:** no persistent storage changes; runtime-only UI behavior. Main risk is rendering regression in constrained terminal sizes.
- **API surface parity:** add scale awareness for both interactive path and agent-facing path expectations where relevant. Agent API is in `src/agent/reader-api.ts:1` and should remain behaviorally consistent for core reading state.
- **Integration test scenarios:** PTY scenarios should include scale presets, invalid values, help/version interactions, and narrow-terminal behavior.

## SpecFlow Analysis Integration

SpecFlow identified key gaps now captured in this plan:

- Define invalid/malformed preset handling (`--text-scale huge`, missing value).
- Define duplicate flag behavior (`--text-scale small --text-scale large`).
- Define precedence behavior for `--help`/`--version` with `--text-scale`.
- Add measurable acceptance for “larger default readability”.
- Add constrained-terminal checks for `large` preset to avoid unusable layout.

## Acceptance Criteria

### Functional

- [x] `rfaf --text-scale small` applies the small readability preset to in-scope surfaces (`src/cli/index.tsx`, `src/ui/screens/RSVPScreen.tsx`, `src/ui/components/WordDisplay.tsx`, `src/ui/components/StatusBar.tsx`, `src/ui/components/HelpOverlay.tsx`).
- [x] `rfaf --text-scale normal` applies the normal preset deterministically.
- [x] `rfaf --text-scale large` applies the large preset deterministically.
- [x] Running `rfaf` without `--text-scale` uses the new, larger default readability compared to pre-Phase-1.2 baseline.

### Validation & CLI Behavior

- [x] Invalid value (e.g., `--text-scale huge`) returns a clear actionable error listing valid presets.
- [x] Missing value handling for `--text-scale` is explicit and tested.
- [x] Duplicate preset flags have defined and tested behavior.
- [x] `--help`/`--version` interaction with `--text-scale` is defined and tested.

### UI & Terminal Behavior

- [x] In-scope surfaces (word lane, status, help) remain readable and aligned for each preset.
- [x] Narrow terminal behavior remains graceful (no unusable clipping/overlap beyond existing guard behavior).
- [x] Sanitization behavior remains intact for all rendered user-controlled text paths.

### Quality Gates (TDD)

- [x] Tests are added before or alongside implementation for scale mapping/validation behavior.
- [x] `bun test` passes with zero failures.
- [x] `bun x tsc --noEmit` passes.
- [x] PTY validation is updated/re-run for preset-driven readability scenarios.

## Testing Strategy: TDD Required

This phase follows strict TDD: write tests first, run to red, implement minimum code to green, then refactor with tests still green.

### TDD Loop

1. Add or update a focused failing test.
2. Run only the relevant test file.
3. Implement the minimum behavior to pass.
4. Refactor carefully.
5. Re-run full suite (`bun test`) and typecheck (`bun x tsc --noEmit`).

### Planned Test Work (by file)

- **CLI flag contract tests**
  - Add/update tests for preset acceptance, invalid values, missing value, duplicate flags, and help/version interactions.
  - Target files: `tests/cli/session-lifecycle.test.ts` (existing), plus new CLI parsing-focused tests such as `tests/cli/text-scale-args.test.ts`.

- **Scale mapping tests (pure behavior)**
  - Add deterministic mapping tests for `small|normal|large` and default behavior.
  - Target file: new `tests/ui/text-scale.test.ts`.

- **Word lane rendering tests**
  - Extend layout tests to validate scale-driven spacing/emphasis and pivot consistency.
  - Target file: `tests/ui/word-display.test.tsx`.

- **Status/help readability tests**
  - Validate readability output changes per scale while preserving sanitization.
  - Target files: `tests/ui/status-bar.test.tsx`, plus new `tests/ui/help-overlay.test.tsx` if helper extraction is added.

- **Regression/safety tests**
  - Keep sanitization and terminal lifecycle protections green while introducing scale behavior.
  - Target files: `tests/ui/sanitize-terminal-text.test.ts`, `tests/cli/session-lifecycle.test.ts`.

- **PTY acceptance validation**
  - Extend PTY scenarios to include each preset and narrow-terminal behavior.
  - Target artifact update: `docs/validation/2026-03-05-acceptance-pty.md`.

## Suggested Implementation Phases (Planning-Level)

### Phase A: Contract Lock

- Finalize accepted preset values and default behavior.
- Finalize error semantics and precedence behavior for parser/meta flags.

### Phase B: Surface Scope Lock

- Confirm which UI surfaces are in-scope for Phase 1.2 and expected consistency.

### Phase C: Acceptance Matrix

- Define and execute test matrix for happy path, invalid values, duplicates, and constrained terminal conditions.

### Phase D: Regression Validation

- Verify terminal lifecycle and sanitization invariants are unchanged.
- Run automated tests and PTY validation checks.

## Success Metrics

- Users get a visibly larger default reading presentation without extra configuration.
- `--text-scale` presets are predictable and easy to use.
- No regressions in terminal lifecycle safety, sanitization, or ingest protections.
- Test suite and typecheck remain green.

## Dependencies & Risks

- **Risk:** readability is subjective.
  - **Mitigation:** define objective acceptance checks in fixed terminal scenarios.
- **Risk:** layout stress at `large` on small terminals.
  - **Mitigation:** validate against terminal guard and PTY scenarios.
- **Risk:** CLI behavior drift from existing conventions.
  - **Mitigation:** mirror current argument validation/error style and codify in tests.
- **Risk:** accidental scope creep (aliases, numeric model, unrelated UI changes).
  - **Mitigation:** keep strict phase boundary (see brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`).

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-05-rfaf-phase-1-2-text-scale-brainstorm.md`
  - Carried-forward decisions:
    - Use `--text-scale` (not `--font-size`)
    - Use presets (`small|normal|large`), no numeric multipliers
    - Increase default readability
    - Keep scope tightly focused on readability surfaces only

### Internal References

- CLI entry/flags: `src/cli/index.tsx:99`
- Terminal lifecycle safety: `src/cli/session-lifecycle.ts:18`
- Word lane rendering: `src/ui/components/WordDisplay.tsx:45`
- Status rendering: `src/ui/components/StatusBar.tsx:18`
- Help overlay: `src/ui/components/HelpOverlay.tsx:3`
- Screen composition and terminal guard: `src/ui/screens/RSVPScreen.tsx:106`
- Sanitization boundary: `src/ui/sanitize-terminal-text.ts:5`

### Institutional Learnings

- Runtime hardening solution: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- PTY validation guide: `docs/validation/2026-03-05-acceptance-pty.md`
- Ink spike notes: `docs/validation/2026-03-05-ink-spike.md`
