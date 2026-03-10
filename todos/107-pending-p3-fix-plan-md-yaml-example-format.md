---
status: pending
priority: p3
issue_id: "107"
tags: [code-review, docs, quality]
dependencies: []
---

# Update `PLAN.md` Config Example To Actual YAML Syntax

Align documentation sample format with the newly declared YAML config contract.

## Problem Statement

`PLAN.md` now states config path `~/.rfaf/config.yaml` but still presents a TOML-formatted example block. This creates mixed guidance during migration.

## Findings

- `PLAN.md:163` labels config as YAML path.
- `PLAN.md:165` starts a TOML code fence and TOML syntax (`[defaults]`, `[llm]`, etc.).
- Example can mislead users during hard-switch migration.

## Proposed Solutions

### Option 1: Convert Example To YAML

**Approach:** Rewrite the sample block as valid YAML and use `yaml` fenced code block.

**Pros:**
- Clear user guidance
- Matches runtime contract

**Cons:**
- Requires docs editing only

**Effort:** 20-30 minutes

**Risk:** Low

---

### Option 2: Mark Example As Legacy TOML

**Approach:** Keep TOML sample but explicitly label as deprecated legacy conversion aid.

**Pros:**
- Useful for migration comparison

**Cons:**
- Confusing in primary config section

**Effort:** 20-30 minutes

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `PLAN.md`

**Related components:**
- User-facing migration documentation

**Database changes:**
- No

## Resources

- `config.yaml.example`
- `docs/brainstorms/2026-03-10-rfaf-phase-5-subphase-25-yaml-full-config-brainstorm.md`

## Acceptance Criteria

- [ ] Primary config example in `PLAN.md` uses YAML syntax.
- [ ] Example keys match current runtime config contract.
- [ ] No TOML syntax appears in the main YAML section unless explicitly marked legacy.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** Claude Code

**Actions:**
- Reviewed migration docs for format consistency
- Found TOML syntax under YAML heading/path

**Learnings:**
- Format drift in docs creates avoidable migration mistakes.
