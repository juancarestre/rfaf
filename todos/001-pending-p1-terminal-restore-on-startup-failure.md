---
status: complete
priority: p1
issue_id: 001
tags: [code-review, reliability, terminal, cli]
dependencies: []
---

# Problem Statement

Terminal cleanup is not guaranteed if startup fails after entering alternate screen but before the app wait loop begins.

## Findings

- `src/cli/index.tsx:158` enters alternate screen before input validation.
- `src/cli/index.tsx:165` can throw when no interactive stdin is available.
- Cleanup is only in `try/finally` around `app.waitUntilExit()` at `src/cli/index.tsx:182`.

## Proposed Solutions

### Option 1: Wrap startup sequence in outer try/finally
Pros: Guaranteed restore for all failure paths; minimal behavior change.  
Cons: Small refactor around render/init ordering.  
Effort: Small  
Risk: Low

### Option 2: Delay alt-screen entry until after input validation
Pros: Avoids dirty terminal for input-init failures.  
Cons: Still misses failures between render setup and wait call unless additional guard exists.  
Effort: Small  
Risk: Medium

### Option 3: Add global process exit handler for restore
Pros: Catches unexpected failures broadly.  
Cons: More complex lifecycle; can conflict with tests/multiple renders.  
Effort: Medium  
Risk: Medium

## Recommended Action

Option 1.

## Technical Details

- Affected: `src/cli/index.tsx`
- Ensure cursor visibility and screen buffer restoration happen once and always.

## Acceptance Criteria

- [ ] If startup throws before render loop, terminal returns to normal screen.
- [ ] Cursor is visible after any startup failure.
- [ ] Existing quit/sigint behavior remains unchanged.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Implemented `src/cli/session-lifecycle.ts` and integrated it in `src/cli/index.tsx`.
- 2026-03-05: Added `tests/cli/session-lifecycle.test.ts` to verify cleanup/restore on render failure and missing stdin.

## Resources

- Review context: `compound-engineering.local.md`
