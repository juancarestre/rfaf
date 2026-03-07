---
status: complete
priority: p2
issue_id: "046"
tags: [code-review, agent, parity, ui]
dependencies: []
---

# Reconcile agent scroll line-step width with TUI behavior

## Problem Statement

The agent API uses a hardcoded content width for scroll line stepping, while the TUI computes line steps from the live terminal width. That means the same conceptual “next line” action can land on different words across the two interfaces.

## Findings

- `src/agent/reader-api.ts:99` uses fixed width `78` for line computation.
- `src/ui/screens/GuidedScrollScreen.tsx:191` derives content width from actual terminal width and padding.
- Agent-native review flagged this as a real parity gap for scroll mode line stepping.
- Known pattern: guided-scroll line maps must match rendered content measurements (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).

## Proposed Solutions

### Option 1: Add width/content-width to agent line-step commands

**Approach:** Make agent line-step commands accept a width so they can match the caller’s viewport.

**Pros:**
- Most accurate parity
- Makes the API explicit

**Cons:**
- Expands the agent command surface
- Requires callers to provide width

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Document agent line-step as abstract, not viewport-exact

**Approach:** Keep the fixed width but document that agent line stepping is approximate.

**Pros:**
- Minimal code change
- Keeps API simpler

**Cons:**
- Accepts parity drift as a contract

**Effort:** 1 hour

**Risk:** Medium

---

### Option 3: Store an overridable default viewport width in runtime

**Approach:** Let runtimes carry width configuration while defaulting to 78.

**Pros:**
- Better parity without widening every command

**Cons:**
- Adds new runtime state and lifecycle questions

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

Make agent line-step commands accept an optional `contentWidth` so callers can request TUI-equivalent viewport behavior, while keeping a default width for existing callers.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts:99`
- `src/agent/reader-api.ts:160`
- `src/ui/screens/GuidedScrollScreen.tsx:189`
- `tests/agent/reader-api-scroll-parity.test.ts`

**Database changes:**
- Migration needed? No

## Resources

- **Branch:** `feat/runtime-mode-switching`
- **Known pattern:** `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [x] Agent scroll line stepping has an explicit parity contract relative to TUI width
- [x] Tests cover the chosen behavior
- [x] Documentation/comments are updated if parity remains approximate

## Work Log

### 2026-03-07 - Initial Discovery

**By:** OpenCode review workflow

**Actions:**
- Compared scroll line-step implementations in TUI and agent runtime
- Verified agent path still relies on a fixed width constant

**Learnings:**
- This is specifically a parity/contract issue, not a correctness bug in the TUI itself

### 2026-03-07 - Resolution

**By:** OpenCode

**Actions:**
- Expanded `AgentReaderCommand` line-step variants to accept optional `contentWidth` in `src/agent/reader-api.ts`
- Updated the agent line-step path to compute line maps using caller-provided width when present
- Added width-sensitive parity coverage in `tests/agent/reader-api-scroll-parity.test.ts`

**Learnings:**
- Optional viewport width keeps the agent surface backward-compatible while making parity explicit
