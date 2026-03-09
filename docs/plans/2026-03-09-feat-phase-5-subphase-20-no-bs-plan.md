---
title: "feat: Phase 5 Subphase 20 --no-bs"
type: feat
status: completed
date: 2026-03-09
origin: docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md
---

# feat: Phase 5 Subphase 20 `--no-bs`

## Overview

Add `--no-bs` as a deterministic pre-reading transform that removes low-value noise and preserves high-signal content, then continues through the existing reading pipeline.

This plan preserves the brainstorm’s chosen behavior: hybrid deterministic cleanup + constrained LLM focus, same-language output, no new facts, and full CLI/agent parity across file/url/stdin/clipboard (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md`).

## Problem Statement

Users want a one-flag way to remove clutter before reading. Current pipeline can summarize, but does not provide a dedicated no-noise/focus pass with explicit safety constraints.

Without a strict contract, this feature could drift into nondeterministic rewriting (translation, fabrication, or inconsistent source behavior), which conflicts with existing rfaf design principles (deterministic CLI contracts, typed errors, and parity).

## Proposed Solution

Implement `--no-bs` as a two-stage transform with strict contracts:

1. **Deterministic cleanup stage** (rule-based):
   - remove emojis/unreadable symbols
   - strip cookie/legal boilerplate
   - strip promo/clickbait lines
   - strip navigation/link clutter
2. **Constrained LLM focus stage** (optional when configured):
   - compress remaining text while preserving facts and chronology
   - preserve source language
   - never introduce new facts

Ordering rule: if both flags are present, execute `--no-bs` before `--summary` (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md`).

## Why This Approach

Carried forward from brainstorm:
- Chosen approach is **Hybrid deterministic + LLM** for quality/safety balance.
- Rejected alternatives:
  - deterministic-only (safer but weaker relevance focus)
  - LLM-only (faster but higher nondeterminism risk)

(see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md`)

## Technical Approach

### Architecture

- Add `--no-bs` option parsing/validation in CLI option layer (`src/cli/index.tsx`) with deterministic usage semantics.
- Insert no-bs transform seam in reading pipeline before summary stage (`src/cli/reading-pipeline.ts`):
  - `input -> no-bs -> summary -> tokenize -> reading mode transform`
- Add no-bs runtime module(s), likely under `src/llm/` + `src/processor/`/`src/cli/` boundaries:
  - deterministic cleaner
  - constrained LLM no-bs pass with typed runtime errors
- Add agent API parity command/flow in `src/agent/reader-api.ts`.

### Deterministic Contract Matrix

Define and test explicit outcomes:

- `USAGE_INVALID_NO_BS_FLAG` -> exit `2`
- `CONFIG_INVALID_NO_BS` -> exit `2`
- `NO_BS_RUNTIME_TIMEOUT` -> exit `1`
- `NO_BS_RUNTIME_PROVIDER` -> exit `1`
- `NO_BS_RUNTIME_SCHEMA` -> exit `1`
- `NO_BS_LANGUAGE_PRESERVATION_FAILED` -> exit `1`
- `NO_BS_FACT_PRESERVATION_FAILED` -> exit `1`
- `NO_BS_EMPTY_RESULT` -> exit `1` (fail-closed; no silent fallback)

Note: exact symbol names may be refined during implementation, but typed deterministic classes are required.

### System-Wide Impact

#### Interaction Graph

`src/cli/index.tsx` arg parse -> `src/cli/reading-pipeline.ts` transform sequencing -> no-bs stage(s) -> optional summary stage -> tokenization -> mode transforms -> UI runtime.

Agent path mirrors no-bs behavior via `src/agent/reader-api.ts` command surface.

#### Error & Failure Propagation

- Lower-level no-bs errors normalize to typed runtime classes.
- CLI surface maps to deterministic exit codes/messages.
- Agent surface maps to parity-aligned typed error contracts.
- Avoid message-substring-only classification as primary routing rule.

#### State Lifecycle Risks

- No durable DB state.
- Primary risks: partial transform drift, inconsistent retry behavior, parity drift between CLI/agent.

#### API Surface Parity

- CLI and agent must expose equivalent no-bs semantics.
- Source behavior must be uniform across file/url/stdin/clipboard.

#### Integration Test Scenarios

1. `--no-bs` only, all four source types, deterministic success.
2. `--no-bs --summary` sequencing invariant (no-bs before summary regardless of arg order).
3. LLM timeout/retry exhaustion with stable failure contract.
4. Same-language preservation failures.
5. No-new-facts enforcement failures.

## Implementation Phases (TDD-First)

### Phase 1: CLI Contract and Pipeline Ordering (Red -> Green)

Files:
- `tests/cli/summary-args.test.ts` (or new `tests/cli/no-bs-args.test.ts`)
- `tests/cli/*-contract.test.ts` (new no-bs CLI contract file)
- `tests/cli/summarize-to-rsvp-flow.test.ts` (or new no-bs flow test)
- `src/cli/index.tsx`
- `src/cli/reading-pipeline.ts`

Tasks:
- Write failing tests for:
  - `--no-bs` parse/validation
  - deterministic usage failures
  - sequencing: `--no-bs` always before `--summary`
- Implement minimum logic to pass.

Validation:
- `bun test tests/cli/no-bs-args.test.ts tests/cli/no-bs-cli-contract.test.ts tests/cli/no-bs-flow.test.ts`

### Phase 2: Deterministic Cleaner + Safety Invariants (Red -> Green)

Files:
- `tests/processor/no-bs-cleaner.test.ts` (new)
- `tests/fixtures/no-bs-*.txt` (new)
- `src/processor/no-bs-cleaner.ts` (new)

Tasks:
- Add failing fixture-driven tests per noise class + counterexamples.
- Add failing tests for empty-result behavior and mixed-content preservation.
- Implement cleaner with deterministic ordering and stable output normalization.

Validation:
- `bun test tests/processor/no-bs-cleaner.test.ts`

### Phase 3: Constrained LLM Focus Stage (Red -> Green)

Files:
- `tests/llm/no-bs.test.ts` (new)
- `src/llm/no-bs.ts` (new)
- `src/config/llm-config.ts` (if no-bs config bounds needed)

Tasks:
- Add failing tests for:
  - same-language enforcement
  - no-new-facts enforcement heuristic contract
  - timeout/retry/error classification determinism
- Implement constrained LLM stage with bounded retries and typed errors.

Validation:
- `bun test tests/llm/no-bs.test.ts`

### Phase 4: CLI + Agent Parity Across Sources (Red -> Green)

Files:
- `tests/agent/reader-api.test.ts`
- `tests/cli/no-bs-cli-contract.test.ts` (new)
- `tests/cli/no-bs-pty-contract.test.ts` (new, if needed)
- `src/agent/reader-api.ts`

Tasks:
- Add failing parity tests for all source types and failure classes.
- Implement parity mapping and stable envelopes.

Validation:
- `bun test tests/agent/reader-api.test.ts tests/cli/no-bs-cli-contract.test.ts`

### Phase 5: Full Regression and Type Safety

Validation:
- `bun test`
- `bun x tsc --noEmit`

## Acceptance Criteria

### Functional Requirements

- [x] `--no-bs` removes v1 noise classes defined in brainstorm (see brainstorm: `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md`).
- [x] Output remains in original language (no translation) unless future explicit translation flag exists.
- [x] `--no-bs` introduces no new facts.
- [x] `--no-bs --summary` executes in strict order: no-bs then summary.
- [x] Behavior is consistent across file/url/stdin/clipboard.

### Deterministic Contract Requirements

- [x] All no-bs parse/runtime errors are deterministic and typed.
- [x] CLI exit codes preserve existing contracts (`2` usage/config, `1` runtime).
- [x] No silent fallback to original text on no-bs failure.
- [x] CLI and agent error contracts are parity-aligned.

### Quality Gates (TDD)

- [x] For each phase, tests are written first and observed failing before implementation.
- [x] Unit + integration + parity contract suites pass.
- [x] Full test suite and typecheck pass.

## Success Metrics

- High-signal reading output for noisy content fixtures without manual cleanup.
- Zero nondeterministic no-bs failures in CI contract suites.
- No parity drift findings between CLI and agent for no-bs surface.

## Dependencies & Risks

- **Risk:** no-new-facts validation can be over/under strict.
  - **Mitigation:** fixture-based claim-traceability heuristics + fail-closed deterministic behavior for unverifiable outputs.
- **Risk:** language heuristics can cause false positives.
  - **Mitigation:** high-confidence thresholds and mixed-language test corpus.
- **Risk:** added stage increases runtime latency.
  - **Mitigation:** bounded timeouts/retries, optional LLM stage, deterministic cleaner first.

## Sources & References

### Origin
- **Brainstorm document:** `docs/brainstorms/2026-03-09-rfaf-phase-5-subphase-20-no-bs-brainstorm.md`
  - carried-forward decisions: hybrid approach, no-bs before summary, same-language/no-new-facts constraints, full parity scope.

### Internal References
- `src/cli/index.tsx`
- `src/cli/reading-pipeline.ts`
- `src/cli/summarize-flow.ts`
- `src/llm/summarize.ts`
- `src/agent/reader-api.ts`
- `tests/cli/summary-cli-contract.test.ts`
- `tests/agent/reader-api.test.ts`

### Institutional Learnings
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

### SpecFlow Gaps Incorporated
- explicit deterministic contract matrix
- sequencing invariant regardless of flag order
- parity oracle across sources and interfaces
- empty-result fail-closed behavior
- TDD-first enforcement as a quality gate
