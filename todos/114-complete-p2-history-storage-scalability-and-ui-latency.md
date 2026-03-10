---
status: complete
priority: p2
issue_id: "114"
tags: [code-review, performance, scalability, history]
dependencies: ["108"]
---

# Improve History Storage Performance at Scale

## Problem Statement

Current history persistence uses synchronous full-file read/parse/rewrite for every completed session. As record count grows, completion latency and `history` command startup cost increase significantly.

## Findings

- `src/history/history-store.ts:99` performs O(n) append via full-file rewrite.
- `src/history/history-store.ts:96` pretty-prints JSON, increasing I/O volume.
- `src/cli/history-command.ts:12` loads and sorts all records in memory.
- `src/ui/App.tsx:52` currently triggers persistence during interactive transition path, amplifying user-visible pauses.

## Proposed Solutions

### Option 1: Switch to Append-Friendly Storage (Recommended)

**Approach:** Move from JSON-array rewrite to append-oriented format (JSONL or sqlite-backed table) with bounded reads for display.

**Pros:**
- Better asymptotic behavior for writes and reads.
- Reduces UI latency risk at high record counts.

**Cons:**
- Requires storage migration strategy.

**Effort:** Large

**Risk:** Medium

---

### Option 2: Keep JSON Array but Add Compaction + Retention Limits

**Approach:** Retain current format but cap max records/file size and compact periodically.

**Pros:**
- Smaller implementation change.

**Cons:**
- Does not fully remove O(n) write behavior.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented Option 1 partially with append-friendly JSONL storage and linear reverse iteration rendering to remove sorting overhead.

## Technical Details

**Affected files:**
- `src/history/history-store.ts`
- `src/cli/history-command.ts`
- `src/ui/App.tsx`
- `tests/history/history-store-contract.test.ts`

## Resources

- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`

## Acceptance Criteria

- [x] Append/write path remains responsive under 10x/100x history growth.
- [x] `history` command has bounded startup latency and memory behavior.
- [x] Performance regression tests or benchmarks document expected limits.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated performance oracle findings and mapped hotspots.
- Captured scaling risks with current JSON-array rewrite strategy.

**Learnings:**
- Local persistence choices quickly become UX concerns in interactive terminal apps.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Replaced full-file append rewrite with append-oriented JSONL persistence in `src/history/history-store.ts`.
- Removed per-run sort in `src/cli/history-command.ts` by rendering newest-first via reverse iteration.
- Kept backward compatibility for legacy JSON-array history files.

**Learnings:**
- Data format choices directly affect CLI responsiveness at scale.
