---
status: completed
priority: p2
issue_id: "068"
tags: [code-review, parity, agent-api, markdown]
dependencies: []
---

# Add Explicit Agent Contract for Markdown Binary-File Failures

Ensure binary markdown-file failures map explicitly and deterministically in agent API.

## Problem Statement

Markdown ingest can raise `Binary file detected`, but agent mapping currently reaches markdown parse fallback indirectly. Explicit mapping is clearer, easier to test, and less fragile.

## Findings

- Binary detection exists in `src/ingest/markdown.ts`.
- Agent-native review flagged lack of explicit markdown binary mapping branch in `src/agent/reader-api.ts`.

## Proposed Solutions

### Option 1: Explicit binary branch in mapper (Recommended)

**Pros:**
- Minimal diff
- Improves deterministic contract clarity

**Cons:**
- Slightly larger error-code surface if adding dedicated code

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep implicit fallback only

**Pros:**
- No change required

**Cons:**
- Lower clarity and weaker contract documentation

**Effort:** None

**Risk:** Medium

## Recommended Action

Implemented explicit markdown binary-file mapping in agent error contract.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`

## Acceptance Criteria

- [x] `Binary file detected` from markdown ingest maps via explicit branch in agent mapper
- [x] Agent tests assert deterministic code/message behavior for this case
- [x] Existing PDF/EPUB/markdown mappings remain unchanged

## Work Log

### 2026-03-09 - Created from review synthesis

**By:** OpenCode

**Actions:**
- Captured agent-native parity finding for binary markdown failure handling.

### 2026-03-09 - Implemented

**By:** OpenCode

**Actions:**
- Added explicit binary mapping branch in `src/agent/reader-api.ts`.
- Added `MARKDOWN_BINARY` contract code.
- Extended markdown agent failure matrix in `tests/agent/reader-api.test.ts`.
