---
status: pending
priority: p2
issue_id: "092"
tags: [code-review, security, reliability, translate]
dependencies: []
---

# Harden Language Normalizer Input Bounds and Retry Behavior

## Problem Statement

`--translate-to` target strings can flow into the LLM normalizer without strict local bounds/sanitization, increasing cost/latency risk and potential leakage of unintended input. Also, normalizer exposes retry config but does not currently retry transient failures.

## Findings

- Target normalization prompt includes raw target text in `src/llm/language-normalizer.ts:127`.
- Resolver accepts broad non-empty strings in `src/cli/translate-option.ts:30`.
- `LanguageNormalizerInput.maxRetries` exists but no retry loop is implemented around generator call in `src/llm/language-normalizer.ts:177`.

## Proposed Solutions

### Option 1: Strict Local Gate + Transient Retry (Recommended)

**Approach:** Add length and character-policy limits before normalizer LLM call; reject obvious URL/path/control-char values; implement bounded transient retry loop honoring `maxRetries`.

**Pros:**
- Reduces abuse/cost risk.
- Improves reliability on transient provider failures.

**Cons:**
- Must tune policy to avoid rejecting valid locale names.

**Effort:** Medium

**Risk:** Low-Medium

---

### Option 2: Remove LLM Fallback for Unknown Targets

**Approach:** Keep only deterministic local map and canonical BCP-47 parsing.

**Pros:**
- Eliminates LLM prompt surface entirely.

**Cons:**
- Reduces flexibility for fuzzy language names.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/cli/translate-option.ts`
- `src/llm/language-normalizer.ts`
- `tests/llm/language-normalizer.test.ts`

## Resources

- `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`

## Acceptance Criteria

- [ ] Target values are bounded and sanitized before any LLM normalization call.
- [ ] Normalizer retries transient failures deterministically up to configured `maxRetries`.
- [ ] Tests cover policy boundaries and retry behavior.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Combined security and reliability findings for normalizer hardening.

**Learnings:**
- Fallback normalizers need explicit input and retry budgets.
