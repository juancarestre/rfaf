---
title: "feat: Phase 5 Subphase 23 --quiz"
type: feat
status: completed
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md
---

# feat: Phase 5 Subphase 23 `--quiz`

## Overview

Implement `--quiz` as an opt-in, standalone-first retention checkpoint for rfaf, with an intentionally lightweight multiple-choice experience that returns a score and missed topics.

This plan is explicitly TDD-first and carries forward all brainstorm decisions without expanding scope into tutoring or rich pedagogy (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).

## Foundational Brainstorm

Found brainstorm from 2026-03-10: `rfaf-phase-5-subphase-23-quiz`. Using it as the foundation for planning.

## Problem Statement / Motivation

rfaf already helps users read faster, but this subphase adds a direct comprehension loop: "Did I retain the key ideas?" The goal is reinforcement and targeted revisit guidance, not formal testing.

Without a first-class `--quiz` contract, users have no deterministic way to convert a finished reading input into a quick retention check aligned with what they actually read.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`:

- **Chosen approach:** standalone-first quiz, not post-read-only and not dual-entry in this subphase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **Primary outcome:** quick retention check, not exam-grade assessment (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **Result format:** score plus missed topics (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **Question count model:** adaptive to source length, not fixed-size quiz (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **Question format:** multiple-choice only (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **Source of truth:** final displayed/transformed text, not raw input (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- **YAGNI boundary:** no mixed formats, long explanations, tutoring loops, or extra pedagogy in this subphase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).

## Research Consolidation

### Repository Patterns

- CLI options follow centralized yargs parsing + per-feature option resolver modules (`src/cli/index.tsx`, `src/cli/summary-option.ts`, `src/cli/translate-option.ts`, `src/cli/no-bs-option.ts`).
- Existing LLM features use dedicated flow modules with deterministic, typed error handling (`src/cli/summarize-flow.ts`, `src/cli/translate-flow.ts`, `src/cli/no-bs-flow.ts`).
- Canonical content transform order is established in `src/cli/reading-pipeline.ts` and must not be disturbed.
- Existing UI lifecycle patterns prioritize cleanup guarantees and deterministic terminal behavior (`src/cli/session-lifecycle.ts`, `src/ui/screens/RSVPScreen.tsx`).
- Existing test taxonomy supports TDD well: option tests, CLI contracts, flow/integration, PTY contracts (`tests/cli/*`, `tests/llm/*`, `tests/ui/*`).

### Institutional Learnings

- Keep parsing deterministic and argv-driven; avoid environment/filesystem-dependent option semantics (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Use typed/signal-based error classes; avoid message-substring error routing (`docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).
- Fail closed on LLM contract/schema violations; no silent fallback (`docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`).
- Maintain strict terminal lifecycle cleanup and boundary sanitization (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- Preserve TTY/raw-mode safety and deterministic exit code behavior (`compound-engineering.local.md`).

### External Research Decision

External research is skipped. This feature fits existing local patterns, has strong institutional guidance, and does not introduce novel frameworks or high-risk domains.

## Proposed Solution

Add `--quiz` as a standalone-first CLI flow that:

1. Resolves and validates quiz invocation contract deterministically.
2. Builds quiz questions from final displayed text (same transformed text users read).
3. Generates adaptive-length, multiple-choice questions only.
4. Collects answers interactively in terminal (TTY path).
5. Prints score plus missed-topic summary.
6. Fails closed on invalid input, invalid model output, and runtime failures with deterministic exit codes.

## Technical Approach

### Architecture and Scope

Primary seams:
- `src/cli/index.tsx` (flag handling, mode selection, exit semantics)
- `src/cli/reading-pipeline.ts` (source-of-truth transformed text contract)
- `src/cli/errors.ts` (typed error taxonomy)
- `src/cli/session-lifecycle.ts` (cleanup guarantees)
- `src/llm/*` existing patterns for prompt + schema + retries

Expected new modules:
- `src/cli/quiz-option.ts`
- `src/cli/quiz-flow.ts`
- `src/llm/quiz.ts`

Expected tests:
- `tests/cli/quiz-option.test.ts`
- `tests/cli/quiz-cli-contract.test.ts`
- `tests/cli/quiz-flow.test.ts`
- `tests/cli/quiz-pty-contract.test.ts`
- `tests/llm/quiz.test.ts`

### Contract Decisions (Resolved During Planning)

- **TTY policy:** quiz interaction is TTY-required in this subphase; non-TTY quiz attempts fail deterministically with usage/config-classified guidance.
- **Adaptive policy:** question count scales only with content size in this subphase (no performance-adaptive behavior).
- **Insufficient input:** if transformed content is below minimum threshold for meaningful MCQ generation, fail closed with explicit remediation.
- **Cancellation:** interruption exits cleanly and always restores terminal state; no partial score output.
- **Parity decision:** CLI-first scope for this subphase; no new agent `quiz` surface added here.

## System-Wide Impact

- **Interaction graph:** CLI parse -> quiz option resolver -> transformed text source resolution -> quiz generation -> interactive answer loop -> score/missed-topic output.
- **Error propagation:** generation/validation/TTY/runtime errors map to typed CLI errors, then deterministic exit codes.
- **State lifecycle risks:** no persistent storage added; key risk is terminal state leakage on errors/signals, mitigated by existing lifecycle patterns.
- **API surface parity:** no new agent endpoint in this subphase; CLI contract remains isolated and explicit.
- **Integration test scenarios:** valid standalone quiz, invalid invocation, insufficient text, invalid model payload, interruption cleanup, non-TTY deterministic failure.

## SpecFlow Gaps Incorporated

The following gaps from spec-flow analysis are explicitly addressed in this plan:

- Explicit argv legality matrix and deterministic precedence rules.
- Exit-code truth table for usage/config (`2`) vs runtime (`1`) failures.
- Typed error classes for quiz parse/generation/validation/runtime categories.
- Terminal lifecycle guarantees across success/failure/interrupt.
- Sanitization requirements for terminal-visible text.
- Adaptive min/max quiz bounds and deterministic output format.
- Source-boundary guarantee: quiz grounded in final displayed text only.

## TDD-First Implementation Phases

### Phase 1: Option and CLI Contract (Red -> Green)

Tests first:
- `tests/cli/quiz-option.test.ts`
- `tests/cli/quiz-cli-contract.test.ts`

Failing coverage first for:
- legal and illegal `--quiz` invocations
- deterministic usage/config failures and messages
- non-TTY invocation contract

Then implement minimal parsing/validation behavior.

### Phase 2: Quiz Generation Contract (Red -> Green)

Tests first:
- `tests/llm/quiz.test.ts`

Failing coverage first for:
- MCQ schema validity (single correct answer, non-empty prompt/options)
- adaptive question-count bounds
- fail-closed schema/contract violations
- groundedness to transformed source text

Then implement minimal generation flow with strict validation.

### Phase 3: Interactive Quiz Flow + Lifecycle (Red -> Green)

Tests first:
- `tests/cli/quiz-flow.test.ts`
- `tests/cli/quiz-pty-contract.test.ts`

Failing coverage first for:
- answer loop behavior and deterministic result formatting
- score + missed-topics output (including perfect-score empty-state)
- interrupt handling and cleanup guarantees
- terminal sanitization boundaries

Then implement flow orchestration and rendering integration.

### Phase 4: Regression and Quality Gates

- `bun test`
- `bun x tsc --noEmit`

Only refactors with green tests; no scope expansion.

## Acceptance Criteria

- [x] `--quiz` provides a standalone-first retention check (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Quiz objective remains reinforcement-oriented, not formal assessment (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Quiz output includes both score and missed topics (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Question count adapts to content size with explicit min/max bounds (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Question format is multiple-choice only in this subphase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Quiz generation uses final displayed/transformed text as source-of-truth (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`).
- [x] Invalid invocation paths fail deterministically with usage/config-classified errors and exit `2`.
- [x] Runtime/generation/schema failures fail deterministically with runtime-classified errors and exit `1`.
- [x] Terminal lifecycle cleanup and sanitization guarantees hold for success, failure, and interruption.
- [x] Plan stays within YAGNI boundaries: no mixed question formats, no tutoring/explanatory mode, no persistence.
- [x] Tests are written first in each implementation phase (red -> green).
- [x] `bun test` and `bun x tsc --noEmit` pass before completion.

## Success Metrics

- Users can run a quick quiz flow with clear score + missed-topic feedback in one session.
- CI shows zero nondeterministic failures in quiz option and contract suites.
- No terminal lifecycle regressions in PTY validation runs.

## Dependencies & Risks

- **Risk:** LLM returns malformed or weakly grounded quiz payload.
  - **Mitigation:** strict runtime validation + fail-closed behavior.
- **Risk:** interactive lifecycle regressions in TTY/raw mode.
  - **Mitigation:** PTY contract tests + centralized cleanup ownership.
- **Risk:** ambiguous expectations for non-TTY usage.
  - **Mitigation:** explicit contract and deterministic error guidance.
- **Risk:** scope creep into richer pedagogical features.
  - **Mitigation:** enforce brainstorm YAGNI boundaries in acceptance criteria.

## Sources & References

### Origin

- `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-23-quiz-brainstorm.md`

### Internal References

- `src/cli/index.tsx`
- `src/cli/reading-pipeline.ts`
- `src/cli/summarize-flow.ts`
- `src/cli/translate-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/session-lifecycle.ts`
- `src/cli/errors.ts`
- `src/ui/screens/RSVPScreen.tsx`

### Institutional Learnings

- `compound-engineering.local.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/institutional-learnings-analysis.md`
