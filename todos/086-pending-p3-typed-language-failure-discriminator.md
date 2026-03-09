---
status: pending
priority: p3
issue_id: "086"
tags: [code-review, quality, summary]
dependencies: []
---

# Replace Message-Substring Retry Gate with Typed Discriminator

## Problem Statement

Language-preservation retry gating currently uses message substring matching, which is brittle and prone to drift when wording changes.

## Findings

- `src/llm/summarize.ts` uses text inclusion checks for language-preservation failure branching.
- Typed error stage already exists (`SummarizeRuntimeError.stage`) and can be leveraged first.

## Proposed Solutions

### Option 1: Typed-First Error Discriminator (Recommended)

**Approach:** Detect `SummarizeRuntimeError` + explicit reason enum/field first; retain minimal fallback string check only for unknown external errors.

**Pros:**
- Stronger determinism.
- Less coupling to message text.

**Cons:**
- Requires small error-shape extension.

**Effort:** Small-Medium

**Risk:** Low

---

### Option 2: Keep String Checks, Centralize Marker

**Approach:** Keep current approach but reduce duplication around marker constant.

**Pros:**
- Very small refactor.

**Cons:**
- Brittleness remains.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Triage pending.

## Technical Details

**Affected files:**
- `src/llm/summarize.ts`
- `src/cli/errors.ts`

## Resources

- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`

## Acceptance Criteria

- [ ] Retry gating for language-preservation failure is typed-first.
- [ ] Message changes do not silently alter retry behavior.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Logged code-simplicity finding on brittle message-based branching.

**Learnings:**
- Typed contracts are more stable than message parsing in deterministic flows.
