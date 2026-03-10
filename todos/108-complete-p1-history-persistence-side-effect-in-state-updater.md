---
status: complete
priority: p1
issue_id: "108"
tags: [code-review, reliability, architecture, determinism]
dependencies: []
---

# Move History Writes Out of State Updater

## Problem Statement

History persistence is currently triggered inside a React state updater path in the UI runtime. This creates a correctness and determinism risk because state updaters are expected to be pure and may be re-invoked.

## Findings

- `src/ui/App.tsx:52` calls `persistCompletedSessionTransition(...)` within `setRuntime((currentRuntime) => ...)`.
- `src/history/history-runtime.ts:16` performs filesystem writes via `appendHistoryRecord(...)` when transition qualifies.
- This can produce duplicate writes for one logical completion transition if updater execution is replayed.
- Known Pattern: keep lifecycle side effects out of transition calculators (`docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`).

## Proposed Solutions

### Option 1: Post-Transition Effect Boundary (Recommended)

**Approach:** Keep updater pure; emit transition data to local state/ref and persist in a controlled post-update effect.

**Pros:**
- Restores purity and deterministic transition semantics.
- Easier to test with explicit side-effect boundaries.

**Cons:**
- Requires small runtime refactor.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Lifecycle Callback from Session Wrapper

**Approach:** Move persistence to a dedicated runtime lifecycle callback outside React updater logic.

**Pros:**
- Strong separation of concerns.
- Aligns with existing lifecycle ownership patterns.

**Cons:**
- Slightly broader wiring changes.

**Effort:** Medium-Large

**Risk:** Medium

## Recommended Action

Implemented Option 1 by moving persistence to a post-render effect boundary while keeping the state updater pure.

## Technical Details

**Affected files:**
- `src/ui/App.tsx`
- `src/history/history-runtime.ts`
- `tests/engine/history-completion-integration.test.ts`

## Resources

- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] No filesystem writes occur inside React state updater functions.
- [x] A completed session persists exactly once under repeated transition evaluation.
- [x] Existing integration tests remain green and include duplicate-write regression coverage.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated multi-agent findings.
- Confirmed side-effect callsite in updater execution path.

**Learnings:**
- Purity boundaries are critical for deterministic transition behavior in interactive runtimes.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Refactored `src/ui/App.tsx` to remove history writes from `setRuntime` updater.
- Added post-transition persistence in a `useEffect` boundary with previous/current runtime comparison.
- Re-ran integration and full test suites.

**Learnings:**
- Keeping transition functions pure reduces nondeterministic replay risk in interactive runtimes.
