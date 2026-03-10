---
status: pending
priority: p3
issue_id: "113"
tags: [code-review, agent-native, parity, history]
dependencies: []
---

# Add Agent-Native Access to Session History

## Problem Statement

Users can read session history through CLI, but agent surfaces currently have no equivalent structured history capability. This creates a user/agent parity gap.

## Findings

- `src/cli/index.tsx:302` enables `rfaf history` command for users.
- `src/cli/history-command.ts` renders history from persisted store.
- `src/agent/reader-api.ts` currently exposes no history read/list operation.
- Plan note indicates CLI-first scope, so parity can be tracked as follow-up rather than blocking current subphase.

## Proposed Solutions

### Option 1: Add Read-Only Agent History Primitive (Recommended)

**Approach:** Expose structured history listing in agent API with deterministic schema matching store contracts.

**Pros:**
- Restores user/agent capability parity.
- Reuses existing history store implementation.

**Cons:**
- Adds API surface and tests.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Defer Until Multi-Surface History Features Expand

**Approach:** Keep CLI-only for now, but document explicit parity debt and target release.

**Pros:**
- No immediate implementation work.

**Cons:**
- Leaves temporary product inconsistency.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/history/history-store.ts`
- `src/cli/history-command.ts`

## Resources

- `docs/plans/2026-03-10-feat-phase-5-subphase-26-session-history-stats-plan.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Agent API exposes history records with deterministic schema.
- [ ] Agent and CLI behavior share one canonical history contract.
- [ ] Parity tests cover read path for both surfaces.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated agent-native reviewer findings.
- Cross-checked subphase plan scope note and captured parity as explicit follow-up.

**Learnings:**
- CLI-first scope is reasonable, but parity debt should remain visible and tracked.
