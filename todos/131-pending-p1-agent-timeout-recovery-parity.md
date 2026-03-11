---
status: pending
priority: p1
issue_id: "131"
tags: [code-review, agent-native, parity, reliability]
dependencies: []
---

# Agent Timeout Recovery Parity Gap

## Problem Statement

CLI supports timeout recovery (continue/abort), but agent command interfaces do not expose equivalent behavior. This breaks CLI-agent parity for the same transform features.

## Findings

- CLI recovery exists in `src/cli/timeout-recovery.ts` and is used by summarize/no-bs/translate/key-phrases flows.
- Agent commands in `src/agent/reader-api.ts` still fail closed on timeout/runtime with no timeout outcome contract.
- Plan file marks parity acceptance complete while no `src/agent/*` or `tests/agent/*` changes are included in PR #3.

## Proposed Solutions

### Option 1: Add Agent Timeout Outcome Contract (Preferred)

**Approach:** Extend agent command inputs with timeout policy/outcome (`continue|abort`) and implement deterministic fallback semantics.

**Pros:**
- Restores feature parity.
- Predictable for agent callers.

**Cons:**
- Adds API surface for agent commands.

**Effort:** 4-8 hours

**Risk:** Medium

---

### Option 2: Explicitly Document Intentional Parity Exception

**Approach:** Keep mismatch but document that agent mode is strict fail-closed.

**Pros:**
- Minimal code change.

**Cons:**
- Leaves user-visible inconsistency.
- Contradicts existing parity goals.

**Effort:** 1-2 hours

**Risk:** High

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`
- `docs/plans/2026-03-11-feat-unified-timeout-reliability-llm-transforms-plan.md`

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/3
- **Known Pattern:** `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Agent commands have explicit timeout outcome policy
- [ ] CLI and agent parity tests cover timeout continue/abort behavior
- [ ] Plan acceptance criteria accurately reflect implemented parity state
- [ ] Full suite passes

## Work Log

### 2026-03-11 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated agent-native reviewer findings.
- Verified no agent file changes in PR file list.

**Learnings:**
- Current parity claim is stronger than what the diff implements.
