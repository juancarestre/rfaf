---
status: pending
priority: p2
issue_id: "083"
tags: [code-review, architecture, parity, summary]
dependencies: []
---

# Align CLI and Agent Summarization Error Envelope

## Problem Statement

CLI summarize path decorates `SummarizeRuntimeError` with provider/model context while agent summarize path propagates raw errors, producing message-shape drift between surfaces.

## Findings

- CLI wraps/reformats summarize errors in `src/cli/summarize-flow.ts:84` and `src/cli/summarize-flow.ts:91`.
- Agent summarize path forwards errors from `summarizeText` directly in `src/agent/reader-api.ts:535`.
- Contract goal is deterministic parity across CLI and agent surfaces.

## Proposed Solutions

### Option 1: Shared Error Normalizer (Recommended)

**Approach:** Extract shared summarize-error normalization helper used by both CLI and agent paths.

**Pros:**
- Prevents drift.
- Enforces one deterministic envelope.

**Cons:**
- Small refactor across modules.

**Effort:** Medium

**Risk:** Low-Medium

---

### Option 2: Agent-Specific Wrapper Matching CLI

**Approach:** Add agent wrapper logic to mirror CLI behavior.

**Pros:**
- Smaller near-term change.

**Cons:**
- Duplication risk remains.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/cli/summarize-flow.ts`
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`

## Resources

- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`

## Acceptance Criteria

- [ ] CLI and agent summarize failures emit parity-aligned deterministic envelope.
- [ ] Existing timeout/provider/schema stage semantics are preserved.
- [ ] Regression tests assert aligned behavior.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Recorded agent-native parity drift in summarize error surfacing.

**Learnings:**
- Shared contracts should be normalized once, not independently per interface.
