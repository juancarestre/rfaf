---
status: pending
priority: p2
issue_id: "089"
tags: [code-review, cli, translate, contracts]
dependencies: []
---

# Fix Space-Form `--translate-to` BCP-47 Regression

## Problem Statement

`--translate-to value` and `--translate-to=value` should behave equivalently, but current pre-parse heuristics can reject valid language tags in space-separated form (for example numeric subtags like `es-419`).

## Findings

- Heuristic gate in `src/cli/index.tsx:173` only allows letters/spaces/hyphens.
- `--translate-to es-419` may be normalized to empty value path and fail with usage error.
- Canonicalizer in `src/llm/language-normalizer.ts:96` already supports numeric subtags, creating inconsistent user-facing contracts.

## Proposed Solutions

### Option 1: Remove Heuristic and Defer Validation (Recommended)

**Approach:** For `--translate-to`, always consume next token unless missing/next flag; let resolver/normalizer perform canonical validation.

**Pros:**
- One validation source of truth.
- Deterministic behavior across equivalent flag forms.

**Cons:**
- Needs careful test updates for malformed inputs.

**Effort:** Small

**Risk:** Low

---

### Option 2: Expand Heuristic to Full BCP-47

**Approach:** Keep pre-check but implement complete BCP-47-aware token validator.

**Pros:**
- Early rejection still possible.

**Cons:**
- Duplicates normalization logic and is brittle.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/cli/translate-option.ts`
- `tests/cli/translate-cli-contract.test.ts`

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`

## Acceptance Criteria

- [ ] `--translate-to value` and `--translate-to=value` are contract-equivalent.
- [ ] Valid BCP-47 tags with numeric subtags are accepted in both forms.
- [ ] CLI contract tests cover both forms and edge cases.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Recorded parser inconsistency from TypeScript/simplicity agent findings.

**Learnings:**
- Option pre-normalization should not outgrow canonical validators.
