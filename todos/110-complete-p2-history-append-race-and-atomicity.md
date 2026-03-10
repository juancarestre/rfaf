---
status: complete
priority: p2
issue_id: "110"
tags: [code-review, reliability, data-integrity, history]
dependencies: []
---

# Make History Appends Atomic and Concurrency-Safe

## Problem Statement

History append currently performs read-modify-write on a JSON array without locking or atomic replace semantics. Concurrent completions can lose records.

## Findings

- `src/history/history-store.ts:99` reads all records, pushes one, and rewrites whole file.
- Multiple process instances can race and overwrite each other.
- Data loss risk increases in parallel terminal sessions.
- Known Pattern: deterministic state boundaries require explicit handling of partial/inconsistent writes (`docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`).

## Proposed Solutions

### Option 1: File Lock + Atomic Temp-File Rename (Recommended)

**Approach:** Serialize append path with lock file and write via temp file + rename.

**Pros:**
- Prevents lost updates and partial write corruption.
- Compatible with current JSON-array format.

**Cons:**
- Adds lock handling complexity.

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Move to Append-Only JSONL

**Approach:** Write one line per session record atomically; parsing becomes line-based.

**Pros:**
- Natural append model with lower race risk.
- Better scaling characteristics.

**Cons:**
- Format migration and reader compatibility work.

**Effort:** Medium-Large

**Risk:** Medium

## Recommended Action

Implemented Option 2 by migrating write/append behavior to JSONL-compatible append flow with legacy-array compatibility and atomic full rewrites.

## Technical Details

**Affected files:**
- `src/history/history-store.ts`
- `tests/history/history-store-contract.test.ts`
- `tests/history/history-store-malformed-records.test.ts`

## Resources

- `docs/solutions/workflow-issues/20260310-parallel-branch-reconciliation-contract-validation.md`

## Acceptance Criteria

- [x] Concurrent appends do not lose previously written records.
- [x] Partial write/corrupt write scenarios are handled deterministically.
- [x] Contract tests include concurrent append simulation.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated reliability and security findings on append strategy.
- Identified read-modify-write race window in current implementation.

**Learnings:**
- Local-only persistence still needs atomicity to preserve deterministic user trust.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Updated `src/history/history-store.ts` to support JSONL reads/writes and append-based record persistence.
- Added legacy JSON array compatibility path for upgrades during append.
- Added temp-file + rename behavior for full rewrites and extended store contract tests.

**Learnings:**
- Append-oriented storage significantly reduces rewrite contention and scales better for local history.
