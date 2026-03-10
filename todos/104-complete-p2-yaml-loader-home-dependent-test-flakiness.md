---
status: complete
priority: p2
issue_id: "104"
tags: [code-review, test, config, reliability]
dependencies: ["103"]
---

# Remove HOME-Dependent Flakiness In YAML Loader Contract Test

Stabilize migration contract tests so they do not depend on process-level HOME mutation behavior.

## Problem Statement

The TOML-only migration test currently mutates `process.env.HOME` and assumes loader default-path behavior follows immediately. This can be runtime-dependent and reduce confidence in migration contract coverage.

## Findings

- `tests/config/yaml-loader-contract.test.ts:56` mutates `process.env.HOME`.
- Test calls `loadLLMConfig(...)` without explicit path in that case.
- Loader default path uses `homedir()` in `src/config/llm-config.ts:223`; behavior can vary with runtime environment details.

## Proposed Solutions

### Option 1: Use Explicit Config Path In Test

**Approach:** Build a temp `.rfaf` directory, pass explicit YAML path to `loadLLMConfig`, and assert migration behavior with sibling TOML fixture.

**Pros:**
- Deterministic test behavior
- No global env mutation

**Cons:**
- Requires loader path contract alignment (issue 103)

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Keep HOME Mutation With Extra Guards

**Approach:** Continue HOME mutation but add defensive assertions and reset helpers.

**Pros:**
- Minimal changes

**Cons:**
- Still environment-coupled and brittle

**Effort:** 30-45 minutes

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `tests/config/yaml-loader-contract.test.ts`
- `src/config/llm-config.ts` (if test requires loader contract adjustment)

**Related components:**
- Config migration contract tests

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] Migration-contract test no longer depends on `process.env.HOME` mutation.
- [ ] Test passes deterministically across local and CI environments.
- [ ] Migration guidance assertion remains explicit and stable.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** Claude Code

**Actions:**
- Reviewed loader contract tests and identified environment-dependent path assumptions
- Documented deterministic testing alternative with explicit paths

**Learnings:**
- Contract tests are strongest when they avoid ambient process state.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Reworked TOML-only migration contract test to avoid `process.env.HOME` mutation in `tests/config/yaml-loader-contract.test.ts`
- Switched test to explicit temp config path invocation and sibling TOML fixture assertions

**Learnings:**
- Explicit-path tests remove runtime-dependent home resolution behavior and improve CI determinism.
