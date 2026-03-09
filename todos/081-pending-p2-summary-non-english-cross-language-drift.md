---
status: pending
priority: p2
issue_id: "081"
tags: [code-review, reliability, summary]
dependencies: ["080"]
---

# Detect Non-English to Non-English Translation Drift

## Problem Statement

The current language-preservation guard primarily rejects non-English to English drift, but can miss cross-language drift between non-English languages.

## Findings

- `src/llm/summarize.ts:178` and `src/llm/summarize.ts:183` focus mismatch gating on English summary detection.
- This allows certain source/summary language mismatches to pass despite “same language as input” contract intent.

## Proposed Solutions

### Option 1: Source-vs-Summary Language Class Comparison (Recommended)

**Approach:** Compare high-confidence language/script classes for source and summary; reject when classes differ.

**Pros:**
- Better alignment with explicit same-language contract.
- Covers broader mismatch cases.

**Cons:**
- Requires careful confidence thresholds.

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Expand English-Centric Rules

**Approach:** Add more non-English markers while keeping English as primary mismatch anchor.

**Pros:**
- Smaller refactor.

**Cons:**
- Patchy coverage; more drift risk.

**Effort:** Small-Medium

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `tests/llm/summarize.test.ts`

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] High-confidence cross-language non-English mismatches are rejected deterministically.
- [ ] False positives remain low with thresholded checks.
- [ ] Added tests for at least one non-English to different non-English mismatch case.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured review finding about incomplete mismatch coverage.

**Learnings:**
- Same-language contracts need explicit source-vs-summary comparison, not one-direction heuristics.
