---
title: "feat: Unified Timeout Reliability for LLM Transforms"
type: feat
status: completed
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md
---

# feat: Unified Timeout Reliability for LLM Transforms

## Overview

Implement a unified adaptive timeout policy across `--summary`, `--no-bs`, `--translate-to`, and `--key-phrases` so long-document transforms complete more reliably under bounded runtime limits (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`).

This plan is explicitly TDD-first and preserves deterministic CLI contracts.

## Problem Statement / Motivation

Current timeout behavior is inconsistent across transform paths:

- `summary` and `no-bs` already enforce a cross-attempt/global deadline.
- `translate` and `key-phrases` mostly rely on per-call timeout semantics.

For long inputs (for example full PDFs), users can hit timeout failures before completion, such as:

- `Summarization failed [timeout]: request timed out. (provider=google, model=gemini-3.1-flash-lite-preview)`

The product goal is higher completion for long docs by default, while keeping strict bounded behavior and explicit messaging (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`).

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`:

- One timeout strategy across all transforms, not transform-specific behavior (see brainstorm: Key Decisions).
- Prefer long-doc completion over fast-fail defaults (see brainstorm: Key Decisions, Resolved Questions).
- Keep hard bounded limits and explicit timeout messaging (see brainstorm: Key Decisions).
- If timeout persists, offer continue-without-transform UX (see brainstorm: Key Decisions).
- Preserve deterministic explicit outcomes; no silent partial low-confidence output by default (see brainstorm: Key Decisions).
- Open questions from brainstorm are already resolved (`None`) (see brainstorm: Open Questions).

## Research Decision

External research is skipped.

Reason: strong local patterns already exist for timeout/retry/error contracts, plus recent institutional learnings for deterministic CLI and transform parity. This is not a new framework/domain problem; it is an internal contract-unification problem.

## Consolidated Research Findings

### Repository Patterns

- Shared transform order is contract-critical: `no-bs -> summary -> translate -> key-phrases` (`src/cli/reading-pipeline.ts:73`).
- Global timeout defaults come from config and are bounded (`src/config/llm-config.ts:8`, `src/config/llm-config.ts:203`).
- Summary/no-bs already use global deadline budget semantics (`src/llm/summarize.ts:386`, `src/llm/no-bs.ts:434`).
- Translate/key-phrases currently differ and should converge under one policy (`src/llm/translate.ts:367`, `src/llm/key-phrases.ts:260`).
- CLI failure taxonomy and exit behavior are deterministic and should be preserved (`src/cli/errors.ts:15`, `src/cli/index.tsx:599`).
- Warning convention is `[warn] ...` and should be reused for skip-path transparency (`src/cli/index.tsx:539`).

### Existing Test Patterns to Reuse (TDD)

- LLM contract tests with deterministic generator mocks: `tests/llm/summarize.test.ts:75`, `tests/llm/no-bs.test.ts:84`, `tests/llm/translate.test.ts:53`, `tests/llm/key-phrases.test.ts:35`.
- Long-input boundary contracts already exist for summary/no-bs and chunking (`tests/llm/summary-long-input-boundary.test.ts:32`, `tests/llm/no-bs-long-input-boundary.test.ts:30`, `tests/llm/long-input-chunking-contract.test.ts:24`).
- CLI contract tests assert exit codes and stderr envelopes (`tests/cli/summary-cli-contract.test.ts:90`, `tests/cli/no-bs-cli-contract.test.ts:44`, `tests/cli/key-phrases-cli-contract.test.ts:133`).

### Institutional Learnings Applied

- Keep deterministic retry/error semantics explicit and bounded (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Preserve strict fail/contract ordering in transform pipelines (`docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`).
- Runtime checks and contract tests are mandatory; prompts are not enough (`docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`).
- Timeout handling must be cooperatively contained (abort + loop checks) (`docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`).

## Proposed Solution

Define and adopt one adaptive timeout contract for all LLM transforms.

Policy intent:

1. Use adaptive budget tiers based on input size (longer inputs get larger bounded budgets).
2. Keep strict hard caps and bounded retries.
3. Use deterministic staged error taxonomy (`timeout`, `network`, `schema`, etc.).
4. On persistent timeout, surface explicit continue-without-transform option in interactive TTY mode.
5. In non-interactive mode, avoid prompt hangs and proceed with deterministic skip behavior plus `[warn]` transparency.

No provider-fallback chain and no silent partial transform output by default (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`).

## Technical Considerations

- **Architecture impacts:** consolidate timeout policy/state into shared transform-runtime contract, then apply uniformly in summarize/no-bs/translate/key-phrases paths.
- **Performance implications:** long docs may run longer; bounded cap and retry limits remain required.
- **UX implications:** explicit skip-path messaging must not feel like hidden failures.
- **Security/quality implications:** no secret leakage in errors; preserve existing sanitization and redaction boundaries.

## System-Wide Impact

- **Interaction graph:** CLI flags -> `reading-pipeline` transform chain -> per-transform runtime contract -> downstream tokenization/mode rendering.
- **Error propagation:** timeout classification and retry behavior must be consistent across all four transforms and map deterministically to CLI output/exit behavior.
- **State lifecycle risks:** skipped transform paths must feed a clearly defined downstream artifact and never produce ambiguous partial state.
- **API surface parity:** CLI and agent flows need the same timeout/skip semantics for equivalent commands.
- **Integration test scenarios:** timeout at each stage in chain, mixed timeout+retry outcomes, non-interactive skip behavior, and cancellation during retries.

## SpecFlow Gaps Incorporated

This plan includes SpecFlow-required clarifications:

- One canonical timeout state machine across all transforms.
- Explicit budget accounting rules and hard caps.
- Explicit interactive vs non-interactive behavior on persistent timeout.
- Explicit continuation artifact rules for skipped transforms.
- Deterministic final outcome states and exit behavior.
- Deterministic test seams (clock/provider/prompt harness) to prevent flaky timeout tests.

## TDD-First Implementation Phases (Red -> Green)

### Phase 1: Shared Timeout Contract Tests

Add failing tests first:

- `tests/llm/timeout-policy-contract.test.ts` (new)
- `tests/llm/timeout-budget-tier-boundary.test.ts` (new)
- `tests/llm/timeout-outcome-contract.test.ts` (new)

Lock:

- adaptive budget tier boundaries,
- retry/backoff budget accounting,
- deterministic outcome classification.

### Phase 2: Transform-Level Timeout Parity Tests

Add failing tests first:

- `tests/llm/translate-timeout-contract.test.ts` (new)
- `tests/llm/key-phrases-timeout-contract.test.ts` (new)
- `tests/llm/summarize.test.ts` (extend)
- `tests/llm/no-bs.test.ts` (extend)

Lock:

- shared policy enforcement across all four transforms,
- same timeout/retry staging conventions.

### Phase 3: CLI Continuation UX Contracts

Add failing tests first:

- `tests/cli/summary-cli-contract.test.ts` (extend)
- `tests/cli/no-bs-cli-contract.test.ts` (extend)
- `tests/cli/translate-cli-contract.test.ts` (new)
- `tests/cli/key-phrases-cli-contract.test.ts` (extend)
- `tests/cli/timeout-continue-without-transform-contract.test.ts` (new)

Lock:

- interactive prompt availability,
- non-interactive deterministic skip default,
- `[warn]` transparency and exit behavior contracts.

### Phase 4: Shared Runtime Policy Integration

Implement after tests are red:

- `src/config/llm-config.ts` (extend policy bounds if needed)
- `src/llm/summarize.ts` (align to shared contract)
- `src/llm/no-bs.ts` (align to shared contract)
- `src/llm/translate.ts` (align to shared contract)
- `src/llm/key-phrases.ts` (align to shared contract)
- `src/cli/summarize-flow.ts` (continue/skip contract wiring)
- `src/cli/no-bs-flow.ts` (continue/skip contract wiring)
- `src/cli/translate-flow.ts` (continue/skip contract wiring)
- `src/cli/key-phrases-flow.ts` (continue/skip contract wiring)

### Phase 5: Pipeline and Parity Integration Tests

Add/extend failing tests first:

- `tests/cli/summary-chunked-flow.test.ts` (extend)
- `tests/cli/summary-scroll-flow.test.ts` (extend)
- `tests/cli/no-bs-order-flow.test.ts` (extend)
- `tests/agent/reader-api.test.ts` (extend)

Lock:

- transform order remains unchanged,
- downstream behavior after skipped transform is deterministic,
- CLI and agent parity.

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`

Refactor only after all tests are green.

## Acceptance Criteria

- [x] A single adaptive timeout policy governs `--summary`, `--no-bs`, `--translate-to`, and `--key-phrases` (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`).
- [x] Long-document completion rate improves for all four transforms under bounded runtime caps.
- [x] Timeout and retry behavior is deterministic and contract-tested across all transforms.
- [x] On persistent timeout in interactive mode, users are offered explicit continue-without-transform choice.
- [x] On persistent timeout in non-interactive mode, flow remains non-blocking and emits explicit `[warn]` about skipped transform.
- [x] No silent partial-transform output is emitted by default; outcomes remain explicit.
- [x] Existing transform order (`no-bs -> summary -> translate -> key-phrases`) remains intact and tested.
- [x] CLI and agent contracts remain parity-aligned for timeout/skip outcomes.
- [x] All work lands TDD-first (tests first, then implementation).
- [x] `bun test` and `bun x tsc --noEmit` pass.

## Success Metrics

- Fewer timeout-related failures for long documents across all transform modes.
- Deterministic and understandable user-facing timeout outcomes (error vs continue-with-skip).
- No regression in existing transform quality guards or exit semantics.

## Dependencies & Risks

- **Risk:** runtime inflation from adaptive budgets.
  - **Mitigation:** strict cap, bounded retries, and explicit budget tests.
- **Risk:** non-interactive hangs from timeout prompt behavior.
  - **Mitigation:** explicit non-interactive default path and CI contract tests.
- **Risk:** parity drift between transforms/paths.
  - **Mitigation:** shared timeout contract tests plus transform-specific parity suites.
- **Risk:** ambiguous "success" semantics after skip.
  - **Mitigation:** explicit outcome taxonomy and CLI messaging contracts.

## Sources & References

### Origin

- **Origin brainstorm:** `docs/brainstorms/2026-03-11-rfaf-llm-timeout-reliability-brainstorm.md`
- Carried-forward decisions: unified strategy, long-doc success preference, bounded limits, continue-without-transform fallback, deterministic outcomes.

### Internal References

- `src/cli/reading-pipeline.ts:73`
- `src/config/llm-config.ts:8`
- `src/config/llm-config.ts:203`
- `src/llm/summarize.ts:386`
- `src/llm/no-bs.ts:434`
- `src/llm/translate.ts:367`
- `src/llm/key-phrases.ts:260`
- `src/cli/errors.ts:15`
- `src/cli/index.tsx:599`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
