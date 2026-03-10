---
status: complete
priority: p2
issue_id: "103"
tags: [code-review, quality, config, contracts]
dependencies: []
---

# Align Legacy TOML Detection With Active Config Path

Ensure legacy TOML migration detection is derived from the same active config-path context used by the loader.

## Problem Statement

`loadLLMConfig` computes legacy TOML location from `homedir()` while also accepting an explicit `configPath`. This can produce inconsistent migration behavior in custom/sandboxed path contexts.

## Findings

- `src/config/llm-config.ts:226` accepts `configPath` argument.
- `src/config/llm-config.ts:230` derives legacy path from `homedir()` directly.
- When `configPath` points outside home, migration detection may not inspect sibling TOML file near active config target.
- Known pattern: deterministic contract logic should not depend on ambient environment assumptions.

## Proposed Solutions

### Option 1: Derive Legacy Path From Active Config Directory

**Approach:** Compute legacy TOML path from `dirname(configPath)` and gate migration guidance on default-path mode.

**Pros:**
- Deterministic and path-consistent
- Works for custom config locations

**Cons:**
- Slightly more loader branching

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Keep Home-Based Legacy Detection

**Approach:** Leave logic as-is and document that migration guidance applies only to home path.

**Pros:**
- No code change

**Cons:**
- Ambiguous behavior for explicit config paths
- Harder to test deterministically

**Effort:** 30 minutes

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/config/llm-config.ts`
- `tests/config/yaml-loader-contract.test.ts`

**Related components:**
- YAML loader migration branch
- CLI config error contract paths

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

## Acceptance Criteria

- [ ] Legacy TOML detection and migration guidance are computed from active config-path context.
- [ ] Custom config path tests show deterministic behavior.
- [ ] Existing default-path migration behavior remains unchanged for normal users.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** Claude Code

**Actions:**
- Reviewed loader path handling in `src/config/llm-config.ts`
- Confirmed mismatch between active config-path input and legacy detection source
- Linked finding to deterministic contract learnings

**Learnings:**
- Migration guidance must follow the same path context used for actual config loading.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Updated legacy TOML detection to derive `config.toml` from `dirname(configPath)` instead of hardcoding `homedir()` in `src/config/llm-config.ts`
- Preserved deterministic migration guidance path when YAML is missing and sibling TOML exists

**Learnings:**
- Config migration contracts are most reliable when bound to the actively resolved config path.
