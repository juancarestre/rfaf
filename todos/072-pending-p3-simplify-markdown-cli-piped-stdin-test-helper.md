---
status: pending
priority: p3
issue_id: "072"
tags: [code-review, quality, tests, cli]
dependencies: []
---

# Simplify Markdown CLI Piped-stdin Test Helper

Replace shell-escaped command composition with direct stdin piping to reduce fragility.

## Problem Statement

`tests/cli/markdown-cli-contract.test.ts` builds shell-escaped commands for piped stdin behavior. This is harder to reason about and more brittle than direct process piping.

## Findings

- Simplicity review flagged quoted shell string construction in markdown CLI contract tests.
- Similar helper logic exists across source contract tests and can be standardized.

## Proposed Solutions

### Option 1: Shared spawn helper with direct stdin piping (Recommended)

**Pros:**
- Less brittle test harness
- Reusable across markdown/pdf/epub contract tests

**Cons:**
- Small refactor in multiple test files

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/cli/markdown-cli-contract.test.ts`
- `tests/cli/epub-cli-contract.test.ts`
- `tests/cli/pdf-cli-contract.test.ts`
- optional shared utility under `tests/cli/`

## Acceptance Criteria

- [ ] Markdown CLI contract tests avoid shell-escaped command composition
- [ ] Behavior and assertions remain unchanged
- [ ] Optional cross-source helper reuse is established
- [ ] Contract tests remain green

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Logged P3 test helper simplification opportunity.
