---
status: complete
priority: p1
issue_id: "095"
tags: [code-review, security, performance, llm, cli]
dependencies: []
---

# Bound Strategy Input And Runtime Budget

Introduce strict limits for `--strategy` payload size and execution budget so strategy cannot create extreme startup latency/cost or unnecessary data exposure.

## Problem Statement

The strategy path currently sends full source text to the model and reuses summary timeout/retry values. For very large inputs this can create large token/cost spikes and long pre-read delays before the UI starts.

## Findings

- `src/cli/strategy-flow.ts:92` passes full `documentContent` into strategy.
- `src/llm/strategy.ts:37` + `src/llm/strategy.ts:50` build prompt with full source text, no cap/sampling.
- `src/cli/strategy-flow.ts:93` and `src/cli/strategy-flow.ts:94` reuse generic LLM timeout/retry values (summary-config based), which can produce long blocking behavior in a pre-read advisory path.
- Known Pattern: deterministic contract features should define explicit runtime constraints and error semantics in tests.
  - `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
  - `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Proposed Solutions

### Option 1: Hard Character Cap + Head/Tail Sampling

**Approach:** Cap strategy input (for example 4k chars), pass head/tail excerpts only, and annotate prompt that sample was used.

**Pros:**
- Simple and deterministic
- Strongly bounds cost/latency

**Cons:**
- May miss signals in omitted middle content
- Requires careful sample policy docs/tests

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Token-Aware Budgeting + Early Truncation

**Approach:** Estimate token budget and truncate to target tokens before request.

**Pros:**
- Better model-cost alignment
- More portable across languages/scripts

**Cons:**
- More implementation complexity
- Requires token-estimation utilities

**Effort:** 4-8 hours

**Risk:** Medium

---

### Option 3: Skip Remote Strategy For Large Inputs

**Approach:** If input exceeds threshold, skip strategy with deterministic warning and continue read flow.

**Pros:**
- Zero extra latency at large sizes
- Strong privacy/cost protection path

**Cons:**
- No recommendation on large documents
- Less consistent UX

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/cli/strategy-flow.ts`
- `src/llm/strategy.ts`
- `tests/cli/strategy-flow.test.ts`
- `tests/cli/strategy-cli-contract.test.ts`
- `tests/llm/strategy.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `compound-engineering.local.md`
- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [ ] Strategy input is hard-bounded before provider call.
- [ ] Strategy pre-read runtime has explicit timeout/retry budget independent of summary defaults.
- [ ] Large-input behavior is deterministic and covered by contract tests.
- [ ] Warnings/messages remain terminal-safe and deterministic.
- [ ] Existing test suite remains green.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Synthesized security + performance findings from multi-agent review.
- Confirmed uncapped strategy payload in `src/llm/strategy.ts:50`.
- Confirmed strategy timeout/retry coupling in `src/cli/strategy-flow.ts:93`.

**Learnings:**
- Advisory startup features need stricter latency budgets than content-transform features.

### 2026-03-10 - Resolved

**By:** Claude Code

**Actions:**
- Added strategy input bounding to 4,000 chars with deterministic head/tail truncation marker in `src/cli/strategy-flow.ts`.
- Added strategy-specific budget clamps (`MAX_STRATEGY_TIMEOUT_MS=5000`, `MAX_STRATEGY_RETRIES=1`) in `src/cli/strategy-flow.ts`.
- Added coverage for bounded input + clamped budget in `tests/cli/strategy-flow.test.ts`.

**Learnings:**
- Capping advisory LLM features at the flow boundary prevents high startup latency and token-cost spikes while preserving recommendation quality.

## Notes

- This is a merge-blocking risk because it can cause high startup latency and unbounded provider cost on large documents.
