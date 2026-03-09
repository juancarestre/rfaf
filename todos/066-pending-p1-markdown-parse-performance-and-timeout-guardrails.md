---
status: completed
priority: p1
issue_id: "066"
tags: [code-review, performance, security, ingestion, markdown]
dependencies: []
---

# Add Markdown Parse Performance and Timeout Guardrails

Prevent markdown ingest from stalling CLI/agent flows on large or pathological files.

## Problem Statement

Current markdown ingest can be very slow on larger inputs and runs on the critical path before UI render, which can make the CLI appear hung. It also lacks an explicit parse timeout/circuit breaker for parser-heavy cases.

## Findings

- `src/ingest/markdown.ts` performs full tokenization + recursive normalization in-process.
- `src/cli/index.tsx` ingests file content before rendering, so slow parse delays first paint.
- Performance review reported substantial slowdown vs plaintext path and high allocation churn.
- Security/learnings review flagged missing timeout containment as DoS risk.

## Proposed Solutions

### Option 1: Timeout + bounded parse path + large-file fast path (Recommended)

**Pros:**
- Strong risk reduction with moderate scope
- Preserves current architecture

**Cons:**
- Requires clear deterministic fallback behavior

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Worker/subprocess markdown parsing

**Pros:**
- Strongest containment and isolation

**Cons:**
- More complex runtime/test orchestration

**Effort:** Large

**Risk:** Medium

## Recommended Action

Implemented fast deterministic markdown normalization path plus timeout guardrails and abort-aware parser seams.

## Technical Details

**Affected files:**
- `src/ingest/markdown.ts`
- `src/cli/index.tsx`
- `tests/ingest/markdown.test.ts`
- `tests/cli/markdown-cli-contract.test.ts`

## Acceptance Criteria

- [x] Markdown parsing has deterministic timeout/circuit-break behavior
- [x] Large markdown inputs do not freeze UX before deterministic failure/handling
- [x] Performance guardrail tests are added for representative file sizes
- [x] `bun test` and `bun x tsc --noEmit` pass

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Consolidated P1 performance and P2 security/learnings findings into a single guardrail task.

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Replaced markdown AST-heavy path with a bounded line-based normalizer in `src/ingest/markdown.ts`.
- Added `parseTimeoutMs` and timeout wrapper with abort propagation.
- Added timeout and abort-signal regression tests in `tests/ingest/markdown.test.ts`.
- Retained deterministic fail-closed errors and size limits.
