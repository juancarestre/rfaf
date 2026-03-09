---
status: pending
priority: p2
issue_id: "075"
tags: [code-review, performance, ingest, cli]
dependencies: []
---

# Make Clipboard Backend Reads Async With Timeout

## Problem Statement

Clipboard reads currently use synchronous subprocess execution, which blocks the event loop and can cause avoidable latency/stalls in CLI startup and agent-hosted contexts.

## Findings

- `Bun.spawnSync` is used in `src/ingest/clipboard.ts:104`.
- Blocking command execution occurs in the ingest hot path for `--clipboard`.
- No explicit per-backend timeout is enforced.

## Proposed Solutions

### Option 1: Move to Async Subprocess + Timeout

**Approach:** Use `Bun.spawn` and await completion with a bounded timeout per backend probe.

**Pros:**
- Removes event-loop blocking.
- Protects against hung clipboard commands.

**Cons:**
- Slightly more complex subprocess lifecycle code.

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Keep Sync But Add Command Timeout Wrapper

**Approach:** Keep sync path, but wrap backend in external timeout command/tool.

**Pros:**
- Smaller code changes.

**Cons:**
- Platform-specific wrapper fragility.
- Still blocks until wrapper exits.

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ingest/clipboard.ts:99`
- `tests/ingest/clipboard.test.ts`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`
- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [ ] Clipboard backend execution is asynchronous.
- [ ] Timeout behavior is deterministic and tested.
- [ ] Non-clipboard flows remain unaffected.
- [ ] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured performance finding about event-loop blocking in clipboard ingest.

**Learnings:**
- Sync subprocess calls in ingest paths can create avoidable responsiveness risk.

## Notes

- Keep error contract unchanged while changing execution model.
