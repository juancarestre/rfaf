---
status: complete
priority: p2
issue_id: "111"
tags: [code-review, cli, determinism, quality]
dependencies: []
---

# Resolve `history` Subcommand vs Positional Input Ambiguity

## Problem Statement

The new `history` command is dispatched by inspecting `rawArgs[0]` before normal parser flow. This can change legacy positional input semantics for files literally named `history`.

## Findings

- `src/cli/index.tsx:302` returns early when first token equals `history`.
- Previous behavior treated first positional token as file/URL input candidate.
- This creates a command-vs-input ambiguity that may surprise users and drift from deterministic CLI contracts.
- Known Pattern: keep parser behavior centralized and deterministic (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).

## Proposed Solutions

### Option 1: Unify Under Yargs Command Surface (Recommended)

**Approach:** Implement `history` as an explicit parser command in yargs and preserve positional handling rules for default command.

**Pros:**
- Single source of truth for CLI behavior.
- Clear command semantics with less ad-hoc branching.

**Cons:**
- Moderate parser refactor.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Keep Fast Path but Add Escape Rule + Tests

**Approach:** Maintain early branch, but support deterministic escape behavior for literal filename cases (for example `./history`) and lock via contract tests.

**Pros:**
- Smaller patch.

**Cons:**
- Keeps dual-path parsing complexity.

**Effort:** Small-Medium

**Risk:** Medium

## Recommended Action

Implemented Option 2 with deterministic single-token command reservation and contract tests for disambiguation behavior.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `tests/cli/help-cli-contract.test.ts`
- `tests/cli/history-cli-contract.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [x] CLI command/input disambiguation for `history` is explicitly documented and deterministic.
- [x] Contract tests cover both `rfaf history` and literal-file input scenarios.
- [x] Help output remains accurate for command usage.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Reviewed command dispatch path and compared with existing positional parsing conventions.
- Captured ambiguity as deterministic contract risk.

**Learnings:**
- Early raw-arg branching is convenient but brittle for long-term CLI contract evolution.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Changed command dispatch in `src/cli/index.tsx` to reserve only exact single-token `history` invocation.
- Added CLI contract tests for `history --help` and literal file named `history` with additional args.

**Learnings:**
- Narrowing branch predicates keeps command routing deterministic while preserving file-input escape paths.
