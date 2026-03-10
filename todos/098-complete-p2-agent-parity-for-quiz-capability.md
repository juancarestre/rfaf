---
status: complete
priority: p2
issue_id: "098"
tags: [code-review, parity, agent, architecture]
dependencies: []
---

# Decide and Enforce Agent Parity for Quiz

`--quiz` is currently CLI-only, creating an intentional parity gap.

## Problem Statement

A user-visible capability was added to CLI without equivalent agent API support. The plan documents this as intentional for the subphase, but parity status is not enforced by explicit guard tests or capability contracts.

## Findings

- New CLI feature path exists in `src/cli/index.tsx:282` and `src/cli/index.tsx:433`.
- No corresponding quiz command exists in `src/agent/reader-api.ts:100` command surface.
- Plan explicitly states CLI-first scope in `docs/plans/2026-03-10-feat-phase-5-subphase-23-quiz-plan.md:101`.
- Known pattern emphasizes CLI/agent parity or explicit non-goal with tests (`docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).

## Proposed Solutions

### Option 1: Implement agent quiz command now

**Approach:** Add agent command + execution path for quiz generation/scoring using shared quiz module.

**Pros:**
- Restores full parity immediately
- Reduces future drift risk

**Cons:**
- Expands current subphase scope

**Effort:** Medium-Large (4-8 hours)

**Risk:** Medium

---

### Option 2: Keep CLI-only, add explicit parity guard contract

**Approach:** Preserve CLI-only scope, but add tests/docs that explicitly assert quiz is unavailable in agent API for this phase.

**Pros:**
- Keeps MVP scope tight
- Makes parity gap deliberate and visible

**Cons:**
- Feature still unavailable to agents

**Effort:** Small (1-2 hours)

**Risk:** Low

## Recommended Action

Implemented Option 2 for this subphase: keep quiz CLI-only and add an explicit guard contract test proving unsupported quiz commands are rejected by agent API.

## Technical Details

**Affected files:**
- `src/cli/index.tsx:433`
- `src/agent/reader-api.ts:100`
- `docs/plans/2026-03-10-feat-phase-5-subphase-23-quiz-plan.md:101`

**Related components:**
- Agent command surface and contract tests

**Database changes (if any):**
- None

## Resources

- **Known pattern:** `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- **Known pattern:** `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] Parity strategy is explicitly chosen (implement now vs explicit deferral)
- [x] If deferred, tests/docs encode the intentional non-parity contract
- [x] If implemented, agent behavior matches CLI quiz contracts
- [x] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Compared new CLI capability surface with agent command surface
- Cross-checked plan statements for intended scope

**Learnings:**
- Parity gaps are acceptable only when explicit and test-backed

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added explicit agent guard test in `tests/agent/reader-api.test.ts` for unsupported `quiz` command
- Kept CLI-only decision aligned with plan scope
- Validated full suite passes with guard in place

**Learnings:**
- Negative-contract tests are an effective way to make intentional parity gaps explicit and durable

## Notes

- This is an architecture/process guardrail task, not an immediate correctness bug.
