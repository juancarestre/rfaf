---
status: pending
priority: p3
issue_id: "077"
tags: [code-review, security, ingest, cli]
dependencies: []
---

# Harden Clipboard Command Path Resolution

## Problem Statement

Clipboard backend commands are executed by bare executable name, relying on ambient `PATH`, which enables local command hijack in compromised environments.

## Findings

- Bare command names are defined in `src/ingest/clipboard.ts:24`, `src/ingest/clipboard.ts:30`, and `src/ingest/clipboard.ts:36`.
- Commands are executed directly with `Bun.spawnSync` in `src/ingest/clipboard.ts:104`.
- No trusted path resolution or constrained subprocess environment is applied.

## Proposed Solutions

### Option 1: Resolve Absolute Binaries + Minimal PATH

**Approach:** Resolve binaries from trusted system locations and execute with constrained env/PATH.

**Pros:**
- Stronger defense against PATH hijack.
- Clear execution provenance.

**Cons:**
- OS-specific path handling complexity.

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Keep PATH Lookup + Add Documentation Warning

**Approach:** Accept current behavior and document local security assumptions.

**Pros:**
- Minimal change.

**Cons:**
- Risk remains.

**Effort:** 1 hour

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/ingest/clipboard.ts:22`
- `src/ingest/clipboard.ts:104`

**Database changes (if any):**
- Migration needed? No

## Resources

- **Review target:** branch `feat/phase-4-subphase-19-clipboard-support`

## Acceptance Criteria

- [ ] Clipboard executable resolution does not rely on untrusted PATH precedence.
- [ ] Subprocess env is explicitly constrained or documented with enforced assumptions.
- [ ] Behavior remains cross-platform compatible.
- [ ] Tests pass.

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Recorded security-sentinel finding about potential PATH hijack.

**Learnings:**
- Even local-only command execution benefits from explicit trust boundaries.

## Notes

- Classified P3 because exploitation generally requires local environment compromise/control.
