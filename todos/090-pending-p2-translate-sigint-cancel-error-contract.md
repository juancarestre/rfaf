---
status: pending
priority: p2
issue_id: "090"
tags: [code-review, cli, reliability, translate]
dependencies: []
---

# Normalize Translate SIGINT/Cancel Error Contract

## Problem Statement

SIGINT-triggered aborts in translate flow can be reported as generic runtime errors instead of deterministic cancellation/timeout-classified errors, drifting from summarize/no-bs behavior.

## Findings

- Translate flow aborts on SIGINT in `src/cli/translate-flow.ts:207`.
- Error classifier in `src/llm/translate.ts:231` handles timeout/abort text but misses `sigint`/`cancel` normalization used elsewhere.
- This causes user-visible inconsistency in cancellation semantics.

## Proposed Solutions

### Option 1: Add Explicit SIGINT/Cancel Classification (Recommended)

**Approach:** Extend translate classifier to map `sigint/cancel` to deterministic timeout/cancel envelope.

**Pros:**
- Consistent UX with summarize/no-bs.
- Minimal code change.

**Cons:**
- Still message-based classification.

**Effort:** Small

**Risk:** Low

---

### Option 2: Structured Abort Reason Mapping

**Approach:** Pass structured abort reason and classify by typed signal reason rather than message substrings.

**Pros:**
- More robust deterministic classification.

**Cons:**
- Slightly wider refactor.

**Effort:** Medium

**Risk:** Low-Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/cli/translate-flow.ts`
- `src/llm/translate.ts`
- `tests/llm/translate.test.ts`

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] SIGINT during translate maps to deterministic cancellation-class error.
- [ ] Translate cancellation semantics align with summarize/no-bs behavior.
- [ ] Regression tests cover SIGINT/cancel classification.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured cancellation-envelope drift from TypeScript review findings.

**Learnings:**
- Cross-flow cancellation contracts must stay unified.
