---
title: "feat: Phase 6 Summary Proportionality and No-BS Reliability"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md
---

# feat: Phase 6 Summary Proportionality and No-BS Reliability

## Overview

Found brainstorm from 2026-03-10: `rfaf-phase-6-subphase-28-29-behavior-corrections`. Using it as foundation for planning.

Phase 6 is a behavior-correction pass focused on two equal-priority outcomes: proportional `--summary` output length and reliable `--no-bs` behavior on large inputs (including PDF-derived text), while preserving deterministic fail-closed semantics (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).

This plan follows a strict TDD-first approach: each contract is specified as tests first, then implementation, then parity/regression hardening.

## Problem Statement / Motivation

Current `--summary` behavior is preset-driven by fixed sentence guidance, which can produce output lengths that do not scale naturally with source size. In parallel, `--no-bs` can fail on large inputs when content-preservation contracts detect truncation/summarization drift.

Leaving either gap unresolved weakens user trust. Phase 6 therefore treats both corrections as release blockers (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).

## Research Summary

### Local Research (Always-on)

- Pipeline order is already a guarded invariant: `no-bs -> summary -> translate -> key-phrases -> tokenize` in `src/cli/reading-pipeline.ts:73`.
- Summary behavior currently uses fixed sentence bands (non-proportional), centered in `src/llm/summarize.ts:105`.
- No-BS already uses deterministic cleaner + LLM contract checks with fail-closed behavior in `src/cli/no-bs-flow.ts:37` and `src/llm/no-bs.ts:252`.
- CLI/agent parity is expected in existing surfaces (`src/agent/reader-api.ts:666`, `src/agent/reader-api.ts:740`).
- Deterministic CLI exit behavior is a project convention (`compound-engineering.local.md:9`).

### Institutional Learnings

- Prompt instructions alone are insufficient; runtime validators and typed failure classes are required (`docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`).
- Keep fail-closed semantics explicit and avoid silent fallback (`docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`).
- Preserve transform-order invariants and validate them with dedicated tests (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- Keep large-input guardrails deterministic, especially for PDF paths (`docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`).

### External Research Decision

Skipped external research for this plan. Local context is strong, patterns already exist in-repo, and this phase is a correction within established architecture rather than a new external integration.

## Proposed Solution

Adopt the brainstorm's chosen approach: strict proportional summary behavior plus strict large-input no-bs reliability, both under fail-closed contracts (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).

### Behavior Contract

- `--summary short|medium|long` remains the user-facing API, but presets become proportional ratio tiers, not fixed sentence bands (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).
- Proportionality anchor is source word count (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).
- For very short inputs, summaries may remain near-original to avoid over-compression (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).
- `--no-bs` on large inputs must process full content reliably or fail with typed errors; no silent truncation, no partial-by-default success (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).
- If `--no-bs` fails, downstream transforms do not run.

### Alternative Approaches Rejected

- **Summary-first only**: rejected because it leaves large-input no-bs reliability unresolved in the same phase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).
- **Guardrail-only stricter rejection**: rejected because it avoids capability correction for full-content no-bs processing (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).

## Technical Considerations

- Preserve existing pipeline order contract in `src/cli/reading-pipeline.ts:73`.
- Preserve deterministic exit/error semantics in `src/cli/index.tsx:608`.
- Maintain contract-based no-bs validation style already present in `src/llm/no-bs.ts:252`.
- Maintain CLI + agent parity for behavior class and fail-closed outcomes (`src/agent/reader-api.ts:666`).
- Keep scope limited to behavior correction; no new user-facing transform flags in this phase (see brainstorm: `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`).

## System-Wide Impact

- **Interaction graph**: parse flags in `src/cli/index.tsx` -> apply transform order in `src/cli/reading-pipeline.ts` -> run no-bs contract path -> run summary contract path -> tokenize/render.
- **Error propagation**: validation/config failures remain usage-class exits; runtime no-bs/summary contract failures remain runtime-class exits.
- **State lifecycle risks**: no DB state risk, but high risk of partial transform drift and parity drift across CLI/agent if contracts diverge.
- **API surface parity**: both CLI and agent must exhibit equivalent behavior class outcomes for identical inputs and flags.
- **Integration scenarios**: combined flags (`--no-bs --summary`), large PDF-derived text, short-input summaries, and preservation-failure paths.

## SpecFlow Analysis Integration

SpecFlow gaps addressed in this plan:

- Explicitly define anchor source for proportionality:
  - without `--no-bs`: anchor = ingested source text word count
  - with `--no-bs`: anchor = cleaned text word count
- Define monotonic tier ordering for same input: `short <= medium <= long` by output word count.
- Define short-input exception threshold and bounds.
- Define large-input behavior as binary contract: full valid output or fail-closed typed error.
- Define combined-flow gating: no-bs failure blocks summary stage.
- Define parity as behavior-parity, not byte-for-byte text identity.

## Acceptance Criteria

### Functional Requirements

- [ ] `--summary` uses proportional ratio tiers anchored to word count; fixed sentence-band behavior is removed.
- [ ] For the same input/options, summary output word counts satisfy `short <= medium <= long`.
- [ ] For inputs with anchor word count `<= 120`, summaries are allowed near-original behavior with output in the `70%-100%` anchor band.
- [ ] For inputs with anchor word count `> 120`, proportional tier bands are:
  - `short`: `12%-22%`
  - `medium`: `22%-38%`
  - `long`: `38%-60%`
- [ ] `--no-bs` on large fixtures returns complete cleaned output or fails with typed fail-closed errors; silent partial output is never accepted.
- [ ] If `--no-bs` fails, `--summary` does not execute and RSVP does not start.

### Large-Input Reliability Requirements

- [ ] A large-input fixture set exists covering at least:
  - one long plaintext fixture
  - one large PDF-derived fixture (`tests/fixtures/AldousHuxley-Laspuertasdelapercepción.pdf` path or derived text fixture)
  - one long structured-text fixture (e.g., markdown-like)
- [ ] Contract tests verify zero silent truncation/partial-success cases across the fixture set.
- [ ] Preservation-check failures produce stable typed error classes with deterministic CLI exit behavior.

### Deterministic Contract and Parity Requirements

- [ ] Existing transform order invariant remains unchanged (`no-bs -> summary -> translate -> key-phrases -> tokenize`).
- [ ] CLI and agent parity tests assert matching behavior class outcomes (success vs fail-closed class) for same fixtures and flags.
- [ ] No silent fallback to original text when no-bs/summary contracts fail.

### Quality Gates (TDD Required)

- [ ] Each acceptance criterion starts as a failing test (red) before implementation (green).
- [ ] Behavior contracts are covered across `tests/llm`, `tests/cli`, and `tests/agent`.
- [ ] `bun test` passes.
- [ ] `bun x tsc --noEmit` passes.

## TDD-First Execution Slices

### Slice 1: Summary Proportionality Contracts (Red -> Green)

Files:
- `tests/llm/summarize.test.ts`
- `tests/cli/summary-cli-contract.test.ts`
- `src/llm/summarize.ts`

Test focus:
- ratio-tier bounds
- monotonic tier ordering
- short-input near-original exception

### Slice 2: Large-Input No-BS Reliability Contracts (Red -> Green)

Files:
- `tests/llm/no-bs.test.ts`
- `tests/cli/no-bs-cli-contract.test.ts`
- `tests/fixtures/AldousHuxley-Laspuertasdelapercepción.pdf`
- `src/llm/no-bs.ts`
- `src/cli/no-bs-flow.ts`

Test focus:
- full-content vs fail-closed binary outcomes
- zero silent partial success
- stable typed failures on preservation check violation

### Slice 3: Cross-Flow and Parity Hardening (Red -> Green)

Files:
- `tests/cli/no-bs-order-flow.test.ts`
- `tests/agent/reader-api.test.ts`
- `src/cli/reading-pipeline.ts`
- `src/agent/reader-api.ts`

Test focus:
- no-bs failure blocks summary
- fixed transform ordering
- CLI/agent behavior parity for success/failure classes

## Success Metrics

- Summary length behavior matches proportional contracts across short/medium/long fixture bands.
- Large-input no-bs tests show zero silent truncation acceptance in CI.
- No regressions in CLI/agent parity contract suites.

## Dependencies & Risks

- **Risk:** proportional bounds too strict can increase fail rates on edge content.
  - **Mitigation:** fixture-calibrated tolerance bands and explicit short-input exception.
- **Risk:** strict no-bs preservation may over-trigger on noisy PDFs.
  - **Mitigation:** broaden large-fixture corpus and keep typed failures actionable.
- **Risk:** changing summary behavior can break user expectation of presets.
  - **Mitigation:** preserve existing preset names and enforce tier monotonicity.
- **Risk:** parity drift between CLI and agent.
  - **Mitigation:** require parity tests in same phase gate.

## Open Questions

None carried from brainstorm. Resolved in this plan with explicit acceptance thresholds and anchor rules.

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-10-rfaf-phase-6-subphase-28-29-behavior-corrections-brainstorm.md`
- **Carried-forward decisions:**
  - equal priority of summary proportionality + no-bs reliability
  - fail-closed semantics
  - source word-count anchor and preset continuity
  - short-input near-original allowance

### Internal References

- `src/llm/summarize.ts:105`
- `src/llm/no-bs.ts:252`
- `src/cli/no-bs-flow.ts:37`
- `src/cli/reading-pipeline.ts:73`
- `src/cli/index.tsx:608`
- `src/agent/reader-api.ts:666`

### Institutional Learnings

- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
