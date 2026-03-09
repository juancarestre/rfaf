---
status: pending
priority: p1
issue_id: "080"
tags: [code-review, performance, reliability, summary]
dependencies: []
---

# Prevent False Positive Language-Mismatch Retries

## Problem Statement

The current language-preservation heuristic can classify any source containing a single non-Latin character as non-English, which can trigger unnecessary retries/failures even when summary output is valid.

## Findings

- `src/llm/summarize.ts:169` uses a single-character script presence check for non-Latin classification.
- `src/llm/summarize.ts:183` then treats English-looking summary as a violation for those sources.
- This can inflate provider calls and produce avoidable deterministic failures (review finding severity P1).

## Proposed Solutions

### Option 1: Dominant-Script Threshold (Recommended)

**Approach:** Compute script ratios/counts and require high-confidence non-Latin dominance before enforcing mismatch.

**Pros:**
- Reduces false positives and retry inflation.
- Preserves deterministic contract behavior.

**Cons:**
- Slightly more logic than regex presence checks.

**Effort:** Small-Medium

**Risk:** Low

---

### Option 2: Minimum Token Count Gate

**Approach:** Keep current script detection but enforce a minimum non-Latin token count before mismatch checks.

**Pros:**
- Minimal code change.

**Cons:**
- Less robust than ratio-based confidence.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `tests/llm/summarize.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- Review branch: `fix/summary-language-preservation`

## Acceptance Criteria

- [ ] Mixed-language inputs do not trigger language-mismatch failure from a single incidental non-Latin character.
- [ ] Retry behavior remains deterministic and bounded.
- [ ] Added tests for mixed-language edge cases.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated multi-agent review findings.
- Identified false-positive mismatch risk in summary language heuristics.

**Learnings:**
- Script-presence checks are too coarse for production language-preservation contracts.
