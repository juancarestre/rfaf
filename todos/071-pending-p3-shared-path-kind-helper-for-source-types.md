---
status: pending
priority: p3
issue_id: "071"
tags: [code-review, quality, architecture, ingestion]
dependencies: []
---

# Extract Shared Path-Kind Helper for Source Extensions

Avoid extension-classification drift between dispatcher and agent fallback logic.

## Problem Statement

Path extension checks for markdown/epub are duplicated across runtime layers. Future changes could update one location and miss another.

## Findings

- Extension checks exist in `src/ingest/file-dispatcher.ts` and `src/agent/reader-api.ts`.
- Simplicity review flagged this as low-level duplication and drift risk.

## Proposed Solutions

### Option 1: Shared source-kind helper module (Recommended)

**Pros:**
- Single source of truth
- Easier evolution for new source extensions

**Cons:**
- Minor refactor for call sites

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ingest/file-dispatcher.ts`
- `src/agent/reader-api.ts`
- new helper module (e.g., `src/ingest/source-kind.ts`)

## Acceptance Criteria

- [ ] Extension classification logic is centralized
- [ ] Existing routing and fallback behavior remains identical
- [ ] Relevant tests remain green

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Logged duplication/drift concern for source extension classification.
