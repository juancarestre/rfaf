---
title: "feat: Phase 6 Long-Input Summary and No-BS Reliability"
type: feat
status: active
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-rfaf-phase-6-long-input-summary-no-bs-brainstorm.md
---

# feat: Phase 6 Long-Input Summary and No-BS Reliability

## Overview

Implement deterministic long-input handling for `--summary` and `--no-bs` so large inputs (including PDF-derived text) succeed reliably while preserving strict existing contracts.

This plan follows the brainstorm decisions exactly: automatic handling, no new flags, strict guard preservation, fail-closed behavior, and no product-surface expansion (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-phase-6-long-input-summary-no-bs-brainstorm.md`).

## Problem Statement / Motivation

Current summary/no-bs paths can fail on large inputs with schema contract errors even when content is valid, because single-pass transform behavior does not scale reliably across long documents.

The concrete user-facing failures are:

- `Summarization failed [schema]: summary length check failed; output is outside the preset proportional bounds`
- `No-BS failed [schema]: content preservation check failed; cleaned text appears summarized or truncated`

We need long-input reliability without weakening the quality model that keeps output trustworthy.

## Brainstorm Decisions Carried Forward

From `docs/brainstorms/2026-03-11-rfaf-phase-6-long-input-summary-no-bs-brainstorm.md`:

- Use deterministic chunk-and-merge as primary strategy (see brainstorm: Why This Approach).
- Keep strict summary proportionality and no-bs preservation guards (see brainstorm: Key Decisions).
- Do not add new flags; long-input handling is automatic (see brainstorm: Key Decisions).
- Fail closed with typed deterministic errors when chunk-level recovery is exhausted (see brainstorm: Key Decisions).
- Preserve pipeline determinism and existing transform order contracts (see brainstorm: Key Decisions).
- Open questions are already resolved (see brainstorm: Open Questions, Resolved Questions).

## Research Decision

External research is skipped.

Reason: this feature sits in an existing, well-instrumented local contract surface (`summarize.ts`, `no-bs.ts`, `reading-pipeline.ts`) with strong institutional learnings about deterministic CLI behavior, strict guard ordering, and fail-closed parity.

## Consolidated Research Findings

### Repository Patterns

- Transform order is explicit and contract-sensitive: `no-bs -> summary -> translate -> key-phrases -> tokenize` in `src/cli/reading-pipeline.ts:73`.
- Summary strict guards exist for schema, language preservation, and proportional bounds: `src/llm/summarize.ts:90`, `src/llm/summarize.ts:212`, `src/llm/summarize.ts:230`.
- No-BS strict guards exist for schema, language preservation, fact/content preservation: `src/llm/no-bs.ts:90`, `src/llm/no-bs.ts:252`, `src/llm/no-bs.ts:278`, `src/llm/no-bs.ts:308`.
- Long-input and schema-failure tests already exist and should be extended, not replaced: `tests/llm/summarize.test.ts:224`, `tests/llm/no-bs.test.ts:197`, `tests/cli/no-bs-cli-contract.test.ts:106`, `tests/cli/summary-cli-contract.test.ts:149`.
- Existing chunking precedent to reuse: `src/llm/translate-chunking.ts:101` and tests `tests/cli/translate-flow.test.ts:109`.

### Institutional Learnings Applied

- Deterministic CLI/parsing and parity are non-negotiable (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Keep fail-closed contract behavior across summary/no-bs transforms (`docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`).
- Runtime checks must enforce language/content contracts, not prompts alone (`docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`).
- Guard ordering and typed errors must stay explicit and deterministic (`docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`).

## Proposed Solution

Add a shared deterministic long-input transform strategy used by both summary and no-bs:

1. Detect when input exceeds single-pass safe size using explicit trigger metrics.
2. Split into stable chunks with deterministic boundaries/order.
3. Apply existing strict transform logic per chunk with existing retry/error semantics.
4. Merge chunk outputs with deterministic normalization rules.
5. Re-run global strict guard checks on merged output.
6. Fail closed if any nonrecoverable chunk or global guard violation occurs.

No CLI surface change and no flag additions.

## Technical Considerations

- **Architecture impacts:** introduce shared chunk planning/merge primitives for summary and no-bs paths.
- **Performance implications:** long inputs incur additional transform calls; behavior remains bounded and deterministic.
- **Security/quality implications:** strict preservation/proportional guards remain active; no best-effort silent degradation.

## System-Wide Impact

- **Interaction graph:** CLI flags -> reading pipeline -> no-bs/summary runtime -> chunk planner -> chunk transforms -> deterministic merge -> global validation -> downstream pipeline.
- **Error propagation:** chunk failures must map to typed stage-specific errors and short-circuit downstream stages.
- **State lifecycle risks:** no persistent state writes; primary risk is partial transform output leakage, mitigated by all-or-nothing fail-closed behavior.
- **API surface parity:** CLI and agent summarize/no-bs paths must preserve equivalent contracts and failure envelopes.
- **Integration scenarios:** `--summary`, `--no-bs`, and `--no-bs --summary` for long PDF-derived inputs and threshold-edge cases.

## SpecFlow Gaps Incorporated

SpecFlow-required additions included in this plan:

- Explicit chunk-trigger metric and threshold boundary tests (`N-1`, `N`, `N+1`).
- Deterministic chunk boundary/order contract.
- Deterministic merge contract (separator/trim/paragraph behavior).
- Mandatory post-merge global strict validation.
- Explicit all-or-nothing chunk failure semantics.
- Deterministic failure selection rules if/when chunk execution is parallelized.
- Pipeline short-circuit assertions for downstream skip-on-failure.

## TDD-First Implementation Phases

### Phase 1: Contract Tests for Trigger, Planning, and Merge (Red -> Green)

Add failing tests first:

- `tests/llm/long-input-chunking-contract.test.ts` (new)
- `tests/llm/summary-long-input-boundary.test.ts` (new)
- `tests/llm/no-bs-long-input-boundary.test.ts` (new)

Lock contracts for:

- trigger threshold determinism,
- chunk boundary/order determinism,
- merge normalization determinism.

### Phase 2: Shared Long-Input Utilities (Red -> Green)

Implement after failing tests:

- `src/llm/long-input-chunking.ts` (new)
- `src/llm/long-input-merge.ts` (new)

Keep utilities minimal and reusable by both summary/no-bs.

### Phase 3: Summary Long-Input Path (Red -> Green)

Tests first:

- extend `tests/llm/summarize.test.ts`
- extend `tests/cli/summary-cli-contract.test.ts`

Implement in:

- `src/llm/summarize.ts`

Requirements:

- preserve existing strict guards,
- chunk for long inputs,
- post-merge global validation,
- deterministic typed failure envelope.

### Phase 4: No-BS Long-Input Path (Red -> Green)

Tests first:

- extend `tests/llm/no-bs.test.ts`
- extend `tests/cli/no-bs-cli-contract.test.ts`

Implement in:

- `src/llm/no-bs.ts`

Requirements mirror summary phase: strict guards preserved, deterministic chunk-and-merge, fail-closed.

### Phase 5: Pipeline and Parity Integration (Red -> Green)

Tests first:

- extend `tests/cli/no-bs-order-flow.test.ts`
- extend `tests/agent/reader-api.test.ts`

Lock:

- transform order unchanged,
- downstream stages skipped on upstream failure,
- CLI/agent parity for long-input failure/success envelopes.

### Phase 6: Full Quality Gate

- `bun test`
- `bun x tsc --noEmit`

Refactor only after all tests are green.

## Acceptance Criteria

- [ ] `--summary` succeeds on large PDF-derived inputs under deterministic chunk-and-merge while keeping proportional bounds strict.
- [ ] `--no-bs` succeeds on large PDF-derived inputs under deterministic chunk-and-merge while keeping preservation guards strict.
- [ ] Long-input handling is automatic with no new user-facing flags (see brainstorm: `docs/brainstorms/2026-03-11-rfaf-phase-6-long-input-summary-no-bs-brainstorm.md`).
- [ ] Any unrecoverable chunk/global validation failure returns deterministic typed fail-closed errors.
- [ ] Merge behavior is deterministic (ordering, separators, normalization) across runs.
- [ ] Pipeline ordering remains `no-bs -> summary -> translate -> key-phrases -> tokenize` and is contract-tested.
- [ ] CLI and agent surfaces preserve parity for long-input summary/no-bs outcomes.
- [ ] All implementation steps follow TDD red -> green sequencing.
- [ ] `bun test` and `bun x tsc --noEmit` pass.

## Success Metrics

- Previously failing large PDF-derived summary/no-bs scenarios pass deterministically.
- No regression in existing strict schema/guard contracts.
- No nondeterministic behavior observed across repeated runs on same input.

## Dependencies & Risks

- **Risk:** chunk merge may accidentally over-compress or duplicate content.
  - **Mitigation:** deterministic merge tests + global post-merge guard checks.
- **Risk:** guard drift between summary and no-bs implementations.
  - **Mitigation:** shared utilities + mirrored contract tests.
- **Risk:** latent parity drift between CLI and agent behavior.
  - **Mitigation:** explicit parity tests in agent suite during same change.
- **Risk:** scope creep into model tuning/new options.
  - **Mitigation:** no new flags and no prompt/product-surface expansion in this phase.

## Sources & References

### Origin

- `docs/brainstorms/2026-03-11-rfaf-phase-6-long-input-summary-no-bs-brainstorm.md`

### Internal References

- `src/cli/reading-pipeline.ts:73`
- `src/cli/no-bs-flow.ts:37`
- `src/llm/summarize.ts:90`
- `src/llm/summarize.ts:230`
- `src/llm/no-bs.ts:90`
- `src/llm/no-bs.ts:308`
- `src/llm/translate-chunking.ts:101`
- `tests/llm/summarize.test.ts:224`
- `tests/llm/no-bs.test.ts:197`
- `tests/cli/no-bs-cli-contract.test.ts:106`
- `tests/cli/summary-cli-contract.test.ts:149`

### Institutional Learnings

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
