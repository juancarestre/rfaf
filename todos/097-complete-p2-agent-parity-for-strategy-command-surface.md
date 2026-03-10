---
status: complete
priority: p2
issue_id: "097"
tags: [code-review, agent-native, parity, api]
dependencies: []
---

# Add Agent-Native Strategy Parity

Close the parity gap where CLI supports strategy recommendation but agent API has no equivalent command.

## Problem Statement

Users can request `--strategy` in CLI, but agent-facing APIs do not expose strategy recommendation as a first-class operation. Current behavior is explicitly guarded as unsupported, but this remains a feature parity gap.

## Findings

- CLI path supports strategy recommendation + effective mode selection:
  - `src/cli/index.tsx:410`
  - `src/cli/index.tsx:421`
- Agent command union does not include strategy:
  - `src/agent/reader-api.ts:100`
- Guard test confirms defer/absence:
  - `tests/agent/strategy-parity-guard.test.ts:5`
- Known Pattern: ship CLI/agent parity together for user-visible capabilities.
  - `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
  - `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Proposed Solutions

### Option 1: Add `executeAgentStrategyCommand`

**Approach:** Introduce agent command + API that mirrors CLI strategy behavior and returns structured recommendation payload.

**Pros:**
- Full action parity
- Better automation capability

**Cons:**
- Additional API surface and tests

**Effort:** 4-8 hours

**Risk:** Medium

---

### Option 2: Add Shared Service Then Wire Both CLI And Agent

**Approach:** Extract strategy orchestration into shared module; both surfaces consume same logic.

**Pros:**
- Reduces drift risk
- Cleaner long-term architecture

**Cons:**
- Slightly larger refactor upfront

**Effort:** 6-10 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/cli/strategy-flow.ts`
- `src/llm/strategy.ts`
- `tests/agent/reader-api.test.ts`
- `tests/agent/strategy-parity-guard.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [ ] Agent API exposes strategy recommendation equivalent to CLI behavior.
- [ ] Structured output includes recommended mode + rationale and warning/error semantics.
- [ ] Parity tests cover success and failure paths across CLI + agent surfaces.
- [ ] Existing guard test is removed or updated to reflect supported behavior.

## Work Log

### 2026-03-10 - Review Finding Created

**By:** Claude Code

**Actions:**
- Consolidated agent-native reviewer output.
- Confirmed intentional non-support guard test exists.

**Learnings:**
- Guarded defer is acceptable short-term, but parity debt is now explicit and trackable.

### 2026-03-10 - Resolved

**By:** Claude Code

**Actions:**
- Added `executeAgentStrategyCommand` in `src/agent/reader-api.ts` to provide agent-native strategy capability.
- Reused CLI strategy semantics by invoking `strategyBeforeRsvp` with no-op loading adapter and explicit mode-resolution contract.
- Added structured result payload (`recommendedMode`, `appliedMode`, `rationale`, `warning`, `runtime`).
- Replaced guard-only tests with parity behavior tests in `tests/agent/strategy-parity-guard.test.ts`.

**Learnings:**
- Reusing shared strategy orchestration between CLI and agent surfaces reduces parity drift and keeps behavior contracts aligned.

## Notes

- If parity is intentionally deferred, keep this as a ready follow-up before shipping broader agent workflows.
