---
status: pending
priority: p1
issue_id: "088"
tags: [code-review, parity, performance, translate]
dependencies: []
---

# Align CLI and Agent Large-Input Translation Behavior

## Problem Statement

CLI and agent translation paths diverge for large inputs. CLI chunks text before LLM calls, while agent sends one monolithic request. This breaks parity and can fail large translations in agent mode even when CLI succeeds.

## Findings

- CLI chunks before translating in `src/cli/translate-flow.ts:216`.
- Agent translate sends full corpus in one call in `src/agent/reader-api.ts:697`.
- For long inputs, this can hit provider limits and create non-deterministic outcome differences between CLI and agent.
- CLI chunk translation currently runs strictly sequentially (`for` + `await`), so latency scales linearly with chunk count and retries.

## Proposed Solutions

### Option 1: Shared Chunking Utility (Recommended)

**Approach:** Extract chunk planning/execution into a shared module and reuse from both CLI and agent translation paths.

**Pros:**
- Restores deterministic parity.
- One place to evolve chunking rules.
- Enables bounded concurrency and document-level retry budget in one implementation.

**Cons:**
- Requires light refactor across modules.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Agent Wrapper Delegates to CLI Translate Flow

**Approach:** Reuse `translateBeforeRsvp` semantics from agent by injecting dependencies.

**Pros:**
- Maximal contract consistency.

**Cons:**
- Tighter coupling between CLI and agent orchestration.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/cli/translate-flow.ts`
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`

## Resources

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`

## Acceptance Criteria

- [ ] Agent translate path uses same chunking strategy/limits as CLI.
- [ ] Large-input translate behavior is parity-aligned across CLI and agent.
- [ ] Regression tests cover large-input translate parity.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Synthesized parity/performance findings from agent-native and performance review agents.

**Learnings:**
- Translation chunking must be shared to avoid contract drift.
