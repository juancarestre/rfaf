---
status: pending
priority: p3
issue_id: "087"
tags: [code-review, parity, tests, summary]
dependencies: ["083"]
---

# Add End-to-End Agent Parity Test for Language-Preservation Detection

## Problem Statement

Current agent parity coverage for language-preservation failure injects a prebuilt error rather than exercising the full detection path.

## Findings

- Agent test currently validates thrown error shape, not end-to-end detector behavior from generated summary content.
- CLI and LLM tests cover detector behavior, but agent integration path lacks equivalent full-path assertion.

## Proposed Solutions

### Option 1: Add Full-Path Agent Test (Recommended)

**Approach:** Exercise `executeAgentSummarizeCommand` with summarize generator outputs that trigger language mismatch and assert deterministic surfacing.

**Pros:**
- Stronger parity guarantee.
- Catches integration regressions.

**Cons:**
- Slightly more test setup.

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Current Mocked Throw Test

**Approach:** No new e2e agent detector test.

**Pros:**
- Zero additional test runtime.

**Cons:**
- Leaves parity gap in detector-path coverage.

**Effort:** None

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `tests/agent/reader-api.test.ts`
- `tests/llm/summarize.test.ts` (for shared fixtures/helpers if needed)

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Agent test covers mismatch detection via actual summarize output path.
- [ ] Deterministic error contract remains parity-aligned with CLI behavior.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured agent-native-reviewer recommendation to deepen parity test path.

**Learnings:**
- Interface parity requires both behavior parity and test-depth parity.
