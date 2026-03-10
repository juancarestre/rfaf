---
title: "feat: Phase 5 Subphase 24 --strategy"
type: feat
status: completed
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-24-strategy-brainstorm.md
---

# feat: Phase 5 Subphase 24 `--strategy`

## Overview

Add an advisory `--strategy` flag that recommends the best reading mode before reading starts.

In v1, strategy is recommendation-only and never auto-switches modes (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-24-strategy-brainstorm.md`). The recommendation returns exactly one existing mode plus one concise rationale line.

## Problem Statement / Motivation

rfaf already supports multiple reading modes and runtime mode switching, but users currently need to pick a mode manually. A lightweight strategy recommendation improves first-run experience and helps users pick an appropriate mode faster, especially for unfamiliar text types.

This subphase must preserve deterministic CLI behavior and existing mode control semantics:
- explicit user mode selection still has highest authority
- mutating pipeline behavior remains stable
- recommendation failures do not block reading

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-24-strategy-brainstorm.md`:

- Recommendation-only v1, no auto-switching (see brainstorm "What We're Building" and "Key Decisions").
- LLM constrained-output approach chosen over rules-only and hybrid (see brainstorm "Why This Approach").
- Text-only inputs in v1 (no profile/history personalization) (see brainstorm "Key Decisions").
- Output must be one mode plus one-line rationale (see brainstorm "Key Decisions").
- `--mode` wins when both flags are present; strategy still reports would-have-picked result (see brainstorm "Key Decisions").
- Strategy failures are fail-open: warn and continue (see brainstorm "Key Decisions").
- Recommendation domain is closed to existing mode identifiers only (see brainstorm "Key Decisions").
- Open questions are already resolved and no unresolved product questions remain (see brainstorm "Open Questions").

## Research Decision

Found brainstorm from 2026-03-10: `rfaf-phase-5-subphase-24-strategy`. Using it as the planning foundation.

External research is skipped. Local repository patterns and institutional learnings are strong and directly applicable for this feature class (deterministic CLI contracts, LLM output validation, and parity patterns already exist).

## Consolidated Research Findings

### Repository Patterns

- CLI flags follow deterministic normalization and resolver contracts in `src/cli/index.tsx`, `src/cli/*-option.ts`.
- Existing LLM transform order is fixed in `src/cli/reading-pipeline.ts`: `no-bs -> summary -> translate`; strategy must remain non-mutating and not reorder this flow.
- Modes are a strict closed set in `src/cli/mode-option.ts`: `rsvp|chunked|bionic|scroll`.
- Runtime mode switching contracts already exist and are tested in `src/ui/runtime-mode-state.ts` and `tests/cli/runtime-mode-switching-pty-contract.test.ts`.
- Deterministic CLI contract tests use black-box spawn and exact stderr/stdout/exit assertions in `tests/cli/*-cli-contract.test.ts`.

### Institutional Learnings Applied

- Validate model outputs at runtime with strict schemas/enums; prompt constraints alone are insufficient.
- Prefer typed deterministic error/warning classes over message-substring classification.
- Protect CLI/agent parity in the same change set or explicitly scope parity.
- Favor PTY/contract tests for end-to-end CLI behavior, not only unit tests.

Sources: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`, `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`, `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`.

## Proposed Solution

Implement `--strategy` as an advisory pre-read step with strict contracts:

1. Parse `--strategy` as an explicit boolean flag with deterministic argv normalization/validation.
2. Invoke a constrained LLM strategy recommender using the reading text as input (text-only in v1).
3. Validate response shape at runtime:
   - mode must be exactly one of `rsvp|chunked|bionic|scroll`
   - rationale must be one concise line suitable for terminal output
4. Present recommendation before reading starts.
5. If `--mode` is also present, keep explicit mode as active mode and print what strategy would have chosen.
6. On strategy generation/validation/runtime failure, emit deterministic warning and continue reading with existing mode resolution.
7. Keep mutating transform order unchanged (`no-bs -> summary -> translate`).

## Technical Approach

### Architecture

Primary files/seams:
- `src/cli/index.tsx` (flag parse, orchestration, warning/success output, exit behavior)
- `src/cli/mode-option.ts` (canonical mode enum/domain)
- `src/cli/reading-pipeline.ts` (must remain order-stable)
- `src/cli/loading-indicator.ts` and output conventions for deterministic UX
- `src/agent/reader-api.ts` (parity path, if strategy is surfaced through agent in this subphase)

Expected new modules:
- `src/cli/strategy-option.ts`
- `src/cli/strategy-flow.ts`
- `src/llm/strategy.ts`

Expected new tests:
- `tests/cli/strategy-option.test.ts`
- `tests/cli/strategy-args.test.ts`
- `tests/cli/strategy-cli-contract.test.ts`
- `tests/cli/strategy-flow.test.ts`
- parity updates in `tests/agent/reader-api.test.ts` (or explicit non-support guard tests)

### Deterministic Contract Matrix

Usage/parse class (fail-closed):
- invalid valued form (for example `--strategy=value`) -> usage error, exit `2`
- invalid duplicate or malformed argv combinations -> usage error, exit `2`

Runtime strategy class (fail-open):
- config missing/provider key missing
- timeout/network/provider errors
- schema-invalid response
- out-of-domain mode recommendation

All runtime strategy failures must produce stable warning output and continue reading with existing mode resolution (from `--mode` or default `rsvp`).

### Output Contract

Deterministic terminal output requirements:
- Success path: show recommended mode and one-line reason.
- `--mode + --strategy`: show active explicit mode plus strategy would-have-picked line.
- Failure path: show non-blocking warning with deterministic class/stage wording.
- Output text is terminal-safe and sanitized.

## System-Wide Impact

- **Interaction graph:** CLI parse -> option resolvers -> optional strategy advisory step -> existing mutating pipeline (`no-bs -> summary -> translate`) -> tokenize -> mode transform -> UI runtime.
- **Error propagation:** strategy advisory errors map to warning-class behavior and do not alter successful read-flow exit status; usage errors still use existing exit `2` contract.
- **State lifecycle risks:** no persistent storage changes; primary risk is contract drift in CLI output behavior.
- **API surface parity:** if agent exposes strategy, it must share same validation/result semantics; if not exposed, explicit guard tests/documentation should prevent accidental drift.
- **Integration test scenarios:** strategy success, strategy schema-invalid fallback, provider timeout fallback, out-of-domain recommendation fallback, `--mode` precedence with strategy explanation.

## SpecFlow Gaps Incorporated

Added from spec-flow analysis:
- Explicit `--strategy` grammar and invalid form handling.
- Validation precedence with existing help/version contract behavior.
- Precise output-channel/message-shape contracts for success and warning paths.
- Explicit non-mutation guarantee for reading pipeline stage order.
- Edge cases for empty/short/long text and rationale normalization.
- Clear parity decision and tests for agent behavior.

## TDD-First Implementation Phases

### Phase 1: CLI Flag Contract (Red -> Green)

Tests first:
- `tests/cli/strategy-option.test.ts`
- `tests/cli/strategy-args.test.ts`
- `tests/cli/strategy-cli-contract.test.ts`

Add failing coverage for:
- bare `--strategy` valid behavior
- valued/malformed forms rejected deterministically
- duplicate flag behavior
- deterministic usage exit semantics (`2`) and stable messages

Then implement minimal parse/resolve behavior in `src/cli/strategy-option.ts` and wiring in `src/cli/index.tsx`.

### Phase 2: Recommender Contract + Validation (Red -> Green)

Tests first:
- `tests/cli/strategy-flow.test.ts`
- `tests/llm/strategy.test.ts`

Add failing coverage for:
- valid constrained mode output
- out-of-domain mode rejected to warning fallback
- invalid reason shape/line handling
- timeout/network/provider/config failures map to deterministic warning behavior

Then implement constrained model call and runtime validator in `src/llm/strategy.ts` and `src/cli/strategy-flow.ts`.

### Phase 3: Precedence + Integration Contracts (Red -> Green)

Tests first:
- extend `tests/cli/strategy-cli-contract.test.ts`
- extend `tests/cli/no-bs-order-flow.test.ts` (or add `tests/cli/strategy-order-flow.test.ts`)

Add failing coverage for:
- `--mode` precedence with strategy would-have-picked output
- strategy success and failure paths do not change mutating stage order
- reading continues after strategy runtime warning

Then integrate advisory step into CLI orchestration without modifying pipeline mutation order.

### Phase 4: Agent Parity Contract (Red -> Green)

Tests first:
- extend `tests/agent/reader-api.test.ts` for parity if strategy is exposed
- or add explicit non-support guard tests for v1 scope

Then implement parity path or explicit guard/documentation in the same change set.

### Phase 5: Validation Gate + Cleanup

- `bun test`
- `bun x tsc --noEmit`

Refactor only with green tests; no contract changes during cleanup.

## Acceptance Criteria

- [x] `--strategy` exists as an advisory flag and does not auto-switch active mode (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-24-strategy-brainstorm.md`).
- [x] Recommendation input is text-only in v1 (no history/profile personalization).
- [x] Strategy output is constrained to exactly one of `rsvp|chunked|bionic|scroll` plus one-line rationale.
- [x] When both flags are set, explicit `--mode` remains active and strategy still reports would-have-picked mode.
- [x] Strategy runtime failures are fail-open (warn and continue reading), while usage errors remain deterministic fail-closed.
- [x] Existing mutating stage order remains unchanged: `no-bs -> summary -> translate`.
- [x] CLI output/warning contracts are deterministic and covered by contract tests.
- [x] Agent parity is either implemented and tested, or explicitly guarded and tested for deferred scope.
- [x] Tests are written first in every phase (red -> green -> validate).
- [x] `bun test` and `bun x tsc --noEmit` pass.

## Success Metrics

- Users can request strategy guidance without losing explicit control over mode choice.
- Zero nondeterministic contract failures for strategy in CLI test suites.
- No pipeline-order regression from adding strategy advisory step.
- Clear warning behavior on strategy runtime failures with continued successful reading sessions.

## Dependencies & Risks

- **Risk:** model returns invalid/ambiguous mode labels.
  - **Mitigation:** strict enum validator + deterministic warning fallback.
- **Risk:** CLI/agent parity drift.
  - **Mitigation:** parity tests in same subphase or explicit non-support guard tests.
- **Risk:** output contract flakiness in terminal contexts.
  - **Mitigation:** deterministic output formatting and PTY/contract tests.
- **Risk:** future refactors accidentally mutate pipeline order.
  - **Mitigation:** dedicated ordering regression tests and explicit non-mutation contract text in code/docs.

## Sources & References

### Origin

- Brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-24-strategy-brainstorm.md`
- Carried-forward decisions: advisory-only behavior, constrained mode domain, `--mode` precedence, fail-open runtime strategy behavior.

### Internal References

- `src/cli/index.tsx`
- `src/cli/mode-option.ts`
- `src/cli/reading-pipeline.ts`
- `src/ui/runtime-mode-state.ts`
- `src/agent/reader-api.ts`
- `tests/cli/summary-cli-contract.test.ts`
- `tests/cli/no-bs-order-flow.test.ts`
- `tests/cli/runtime-mode-switching-pty-contract.test.ts`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
