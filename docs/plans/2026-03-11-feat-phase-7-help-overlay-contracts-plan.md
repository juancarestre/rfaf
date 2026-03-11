---
title: "feat: Phase 7 Help Overlay Contracts"
type: feat
status: completed
date: 2026-03-11
origin: docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md
---

# feat: Phase 7 Help Overlay Contracts

## Overview

Plan Phase 7 as two tightly scoped contract improvements:

1. In chunked mode, ORP highlighting must never paint whitespace.
2. `--help` output must be grouped into clear sections, with explicit AI-processing flags grouped together.

This plan is TDD-first and intentionally avoids Phase 8 scope expansion (runtime in-app help toggle and release automation) (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Foundational Brainstorm

Found brainstorm from 2026-03-04: `rfaf-mvp-scope`. Using as foundation for planning.

## Problem Statement

Phase 7 goals are explicitly defined, but current behavior still leaves two quality gaps:

- Chunked rendering can compute ORP over strings that contain separator spaces, which can produce whitespace pivots.
- CLI help is currently a flat option list, which makes AI-related flags harder to discover and reason about.

Without closing these gaps, rfaf loses reading clarity in chunked mode and increases UX friction in an increasingly feature-rich CLI.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`:

- **Phase 7 scope is exactly two items**: non-whitespace ORP in chunked mode + sectioned `--help` with emphasis on AI flags (see brainstorm: Phase 7 lines 82-85).
- **Keep yargs as the CLI parser** and build on existing help-generation path rather than introducing a new parser framework (see brainstorm: "Keep yargs").
- **Deep RSVP quality remains product-critical**; this change is a correctness/clarity pass, not a new mode/features pass (see brainstorm: "Deep RSVP only").
- **YAGNI boundary**: do not pull Phase 8 runtime help-overlay toggle work into this subphase (see brainstorm: Phase 8 lines 87-89).
- **Open questions from brainstorm**: none remained in the source brainstorm; this plan resolves only Phase 7 contract ambiguities.

## Research Decision

Proceeding without external research. This is low-risk and well-covered by local code patterns, existing contract tests, and institutional learnings.

## Consolidated Research Findings

### Repository Patterns

- ORP pivot selection currently indexes directly into rendered text in `src/ui/components/WordDisplay.tsx:78` and `src/ui/components/WordDisplay.tsx:99`.
- Chunked text is assembled with internal spaces in `src/processor/chunker.ts:49`, making whitespace pivots plausible when ORP is length-based.
- ORP lookup behavior is centralized in `src/ui/orp.ts:15`; display splitting/layout remains in `WordDisplay`.
- CLI help is built from a single yargs chain in `src/cli/index.tsx:313` through `src/cli/index.tsx:387`; no section grouping is currently used.
- Existing help contracts already assert baseline semantics in `tests/cli/help-cli-contract.test.ts:21` and `tests/cli/compiled-help-contract.test.ts:4`.
- Existing rendering tests validate pivot alignment/sanitization in `tests/ui/word-display.test.tsx:7` but do not enforce non-whitespace pivot fallback.

### Institutional Learnings Applied

- Keep one shared display contract for rendering and navigation/highlighting to avoid drift (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).
- Keep help text and runtime contracts in sync to prevent parity regressions (`docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`).
- Preserve deterministic CLI behavior and avoid speculative abstractions (`compound-engineering.local.md`).
- Validate terminal behavior through PTY-oriented checks where visual behavior matters (`docs/validation/2026-03-05-acceptance-pty.md`).

## Proposed Solution

Define explicit product contracts for both Phase 7 targets:

1. **Chunked ORP contract:** highlighted pivot must be the nearest non-whitespace visible character in the displayed chunk.
2. **No-candidate contract:** if a displayed chunk has no visible character, render safely without pivot emphasis and without crashing.
3. **Help information architecture contract:** `--help` shows explicit labeled sections, including a dedicated "AI Processing" section.
4. **Help parity contract:** source-run and compiled help outputs remain semantically equivalent (same sections, same flag membership, same descriptions).

## Technical Approach

### Architecture and Scope

Primary seams:

- `src/ui/components/WordDisplay.tsx` (final pivot character selection and layout split).
- `src/processor/chunker.ts` (chunk text composition assumptions).
- `src/cli/index.tsx` (yargs help composition and section grouping).
- Existing contracts in `tests/ui/*` and `tests/cli/*`.

Expected new/updated tests:

- `tests/ui/word-display-orp-whitespace-contract.test.tsx` (new)
- `tests/processor/chunked-orp-contract.test.ts` (new)
- `tests/cli/help-cli-sections-contract.test.ts` (new)
- `tests/cli/compiled-help-sections-contract.test.ts` (new)
- Updates to `tests/cli/help-cli-contract.test.ts`

### Contract Decisions (Resolved During Planning)

- **Visible character rule:** a valid pivot is any rendered character that is not Unicode whitespace after terminal sanitization.
- **Fallback direction rule:** choose the nearest non-whitespace index from the raw ORP index; ties resolve to the right for deterministic behavior.
- **No-visible-character rule:** display remains stable with no emphasized pivot and no runtime error.
- **AI section membership:** `--summary`, `--no-bs`, `--translate-to`, `--key-phrases`, `--quiz`, `--strategy`.
- **Help section ordering:** Usage/Input first, core reading/runtime options second, AI Processing third, examples/epilog last.
- **Parity definition:** semantic parity, not byte-for-byte wrapping parity (terminal width may wrap lines differently).

### System-Wide Impact

#### Interaction Graph

Input text -> token/chunk transforms -> `WordDisplay` layout -> pivot highlight contract.

CLI args -> yargs option/help composition -> `--help` output -> source/compiled help contract tests.

#### Error & Failure Propagation

- ORP fallback behavior should eliminate whitespace-pivot visual failures without introducing new error types.
- Help sectioning should preserve existing `--help` success behavior (`exit 0`, empty stderr).

#### State Lifecycle Risks

- No persistent state/database risk.
- Main risk is UX regression from changed pivot position and changed help text ordering.

#### API Surface Parity

- CLI source and compiled entrypoints must stay semantically aligned for help output.
- Agent/tooling surfaces are out of scope for this subphase.

#### Integration Test Scenarios

- Chunked phrases with internal spaces where raw ORP lands on a separator.
- Boundary chunks (short tail chunk, punctuation-adjacent chunk).
- `--help` output includes required sections and AI flag membership with no duplicates.
- Source/compiled `--help` preserve section and membership parity.

## SpecFlow Gaps Incorporated

From spec-flow analysis, this plan explicitly adds:

- Deterministic definition of "non-whitespace" pivot behavior.
- Tie-break and no-candidate fallback rules.
- Explicit help IA contract (section names/order and AI-flag ownership).
- Source-vs-compiled semantic parity criteria for sectioned help.
- Edge-case coverage for punctuation-adjacent and tail chunks.

## Alternative Approaches Considered

- **Approach A: ORP-only hotfix + minimal help text wording tweaks**
  - Pros: smallest code diff.
  - Cons: leaves help discoverability weak and does not codify section ownership.
- **Approach B: Full formatting redesign for help + rendering rewrite**
  - Pros: maximum UX polish.
  - Cons: unnecessary scope/risk for Phase 7.
- **Chosen: contract-first targeted updates** for ORP fallback and grouped help sections, with parity tests.

## TDD-First Implementation Phases

### Phase 1: ORP Whitespace Contract Tests (Red -> Green)

Tests first:

- `tests/ui/word-display-orp-whitespace-contract.test.tsx`
- `tests/processor/chunked-orp-contract.test.ts`

Failing coverage first for:

- raw ORP landing on internal chunk whitespace
- deterministic nearest-visible fallback with tie behavior
- no-visible-character safe behavior

Then implement minimal logic to satisfy the contract.

### Phase 2: Help Section Contract Tests (Red -> Green)

Tests first:

- `tests/cli/help-cli-sections-contract.test.ts`
- `tests/cli/compiled-help-sections-contract.test.ts`

Failing coverage first for:

- required section headers present
- AI Processing section contains canonical AI flags
- no duplicated/omitted options in section membership
- `--help` remains success-path (`exit 0`, no stderr)

Then implement minimal yargs help-section composition.

### Phase 3: Regression Hardening (Red -> Green)

Tests first/updated:

- `tests/ui/word-display.test.tsx`
- `tests/cli/help-cli-contract.test.ts`
- `tests/cli/compiled-help-contract.test.ts`

Coverage focus:

- preserve existing pivot alignment behavior while preventing whitespace pivots
- preserve existing help examples/epilog expectations while adding sections
- preserve source/compiled semantic parity

### Phase 4: Quality Gates

- `bun test`
- `bun x tsc --noEmit`

No scope expansion during cleanup.

## Acceptance Criteria

### Functional Requirements

- [x] Chunked-mode ORP highlight never paints whitespace when a visible character exists (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).
- [x] Fallback behavior for ORP selection is deterministic across tie and boundary cases.
- [x] Chunks containing no visible character render safely without crash.
- [x] `--help` output is split into clear, labeled sections (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).
- [x] `--help` includes a dedicated AI Processing section with canonical AI flags.

### Contract and Reliability Requirements

- [x] Source-run and compiled `--help` are semantically equivalent in section set, flag membership, and descriptions.
- [x] `--help` returns exit code `0` and writes no stderr output for source and compiled runs.
- [x] Existing runtime controls/help examples remain present after sectioning.

### Quality Gates (TDD)

- [x] Each implementation phase starts with failing tests (red -> green).
- [x] Unit + CLI contract suites pass for both ORP and help changes.
- [x] `bun test` and `bun x tsc --noEmit` pass before completion.

## Success Metrics

- No whitespace pivot regressions reported for chunked mode in contract tests.
- Help discoverability improves via explicit AI flag grouping, validated by contract tests.
- No source/compiled help parity regressions in CI.

## Dependencies & Risks

- **Risk:** fallback pivot rules accidentally shift perceived reading rhythm.
  - **Mitigation:** keep fallback minimal/deterministic and preserve existing pivot alignment tests.
- **Risk:** help section grouping causes omissions/duplication as flags evolve.
  - **Mitigation:** canonical membership tests and compiled/source parity tests.
- **Risk:** scope creep into runtime overlay behavior (Phase 8).
  - **Mitigation:** explicit out-of-scope boundary in acceptance criteria and implementation phases.

## Sources & References

### Origin

- Brainstorm document: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
- Key carried-forward decisions: keep yargs, preserve deep RSVP quality focus, implement only Phase 7 items, defer Phase 8 work.

### Internal References

- `src/ui/components/WordDisplay.tsx:66`
- `src/ui/components/WordDisplay.tsx:78`
- `src/ui/components/WordDisplay.tsx:99`
- `src/processor/chunker.ts:49`
- `src/ui/orp.ts:15`
- `src/cli/index.tsx:313`
- `src/cli/index.tsx:330`
- `tests/ui/word-display.test.tsx:7`
- `tests/cli/help-cli-contract.test.ts:21`
- `tests/cli/compiled-help-contract.test.ts:4`

### Institutional Learnings

- `compound-engineering.local.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/validation/2026-03-05-acceptance-pty.md`
