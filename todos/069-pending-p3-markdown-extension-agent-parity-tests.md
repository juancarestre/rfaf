---
status: pending
priority: p3
issue_id: "069"
tags: [code-review, tests, parity, markdown]
dependencies: []
---

# Add Agent Parity Tests for `.markdown` Extension Inputs

Close extension-coverage gap between dispatcher routing tests and agent parity tests.

## Problem Statement

Dispatcher routes both `.md` and `.markdown`, but agent tests only validate `.md` path scenarios.

## Findings

- Dispatcher extension coverage includes case-insensitive markdown forms.
- Agent tests currently assert markdown ingest through `.md` examples only.

## Proposed Solutions

### Option 1: Add focused `.markdown` agent tests (Recommended)

**Pros:**
- Low effort, closes drift gap

**Cons:**
- Small increase in test count

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/agent/reader-api.test.ts`

## Acceptance Criteria

- [ ] Agent ingest tests include `.markdown` extension path
- [ ] Optional uppercase extension case is covered
- [ ] Test suite remains green

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Logged parity-coverage gap noted by agent-native reviewer.
