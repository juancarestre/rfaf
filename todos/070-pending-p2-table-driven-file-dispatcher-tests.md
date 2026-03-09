---
status: completed
priority: p2
issue_id: "070"
tags: [code-review, quality, tests, maintainability]
dependencies: []
---

# Refactor File Dispatcher Tests to Table-Driven Style

Reduce duplication in dispatcher routing/lazy-loader tests as source types grow.

## Problem Statement

`tests/ingest/file-dispatcher.test.ts` now repeats near-identical test scaffolding across markdown, epub, pdf, and plaintext cases. This makes maintenance noisy and increases drift risk.

## Findings

- Simplicity review flagged repeated route assertions and loader setup blocks.
- New source additions will further expand duplicated test code.

## Proposed Solutions

### Option 1: Table-driven routing/lazy tests with shared helpers (Recommended)

**Pros:**
- Lower maintenance cost
- Easier to extend for new source types

**Cons:**
- Moderate refactor of existing tests

**Effort:** Medium

**Risk:** Low

## Recommended Action

Refactored dispatcher contract tests to table-driven routing/lazy-loader cases with shared helper scaffolding.

## Technical Details

**Affected files:**
- `tests/ingest/file-dispatcher.test.ts`

## Acceptance Criteria

- [x] Routing tests use shared helper/table structure
- [x] Lazy-loader assertions remain explicit and readable
- [x] No coverage loss vs current contracts
- [x] Full test suite remains green

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Captured P2 simplicity finding for dispatcher test duplication.

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Rewrote `tests/ingest/file-dispatcher.test.ts` with routing case table and shared reader helper.
- Consolidated lazy-loader tests via table-driven cases.
- Preserved file-over-stdin precedence contract assertion.
