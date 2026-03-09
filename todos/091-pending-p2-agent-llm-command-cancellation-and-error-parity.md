---
status: pending
priority: p2
issue_id: "091"
tags: [code-review, parity, agent, reliability]
dependencies: []
---

# Align Agent LLM Command Cancellation and Error Envelope

## Problem Statement

Agent summarize/no-bs/translate commands do not currently expose cancellation signal handling equivalent to CLI flows, and error-envelope shaping is inconsistent across agent commands.

## Findings

- CLI flows wire `AbortSignal` into LLM calls (`src/cli/summarize-flow.ts:50`, `src/cli/no-bs-flow.ts:58`, `src/cli/translate-flow.ts:207`).
- Agent command interfaces do not include `signal` for summarize/no-bs/translate in `src/agent/reader-api.ts`.
- Agent summarize path returns raw runtime message shapes while CLI wraps provider/model context.

## Proposed Solutions

### Option 1: Shared Agent/CLI LLM Invocation Contract (Recommended)

**Approach:** Add optional `signal` to agent LLM command payloads and centralize error-envelope normalization helper used by both interfaces.

**Pros:**
- Strong parity and deterministic error behavior.
- Lower drift risk.

**Cons:**
- Requires test and interface updates.

**Effort:** Medium

**Risk:** Low-Medium

---

### Option 2: Agent-Only Shim

**Approach:** Keep CLI as-is; add local wrappers in agent commands for cancellation and envelope formatting.

**Pros:**
- Smaller initial change.

**Cons:**
- Duplicates contract logic.

**Effort:** Small-Medium

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/cli/summarize-flow.ts`
- `src/cli/no-bs-flow.ts`
- `src/cli/translate-flow.ts`
- `tests/agent/reader-api.test.ts`

## Resources

- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`

## Acceptance Criteria

- [ ] Agent summarize/no-bs/translate support optional cancellation signal semantics.
- [ ] Agent and CLI expose parity-aligned deterministic runtime error envelopes.
- [ ] Agent parity tests cover cancellation and error-shape equivalence.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated agent-native reviewer parity gaps into one actionable todo.

**Learnings:**
- Interface parity requires both behavior and envelope parity.
