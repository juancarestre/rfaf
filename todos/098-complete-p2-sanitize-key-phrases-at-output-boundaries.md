---
status: complete
priority: p2
issue_id: "098"
tags: [code-review, security, terminal, ui]
dependencies: []
---

# Sanitize Key-Phrase Output Boundaries

Ensure key phrases are sanitized before printing/rendering in list and preview paths.

## Problem Statement

LLM-derived key phrases currently flow to output surfaces without explicit sanitization in all paths. This leaves room for ANSI/OSC control-sequence injection into terminal output.

## Findings

- Security review identified direct phrase rendering/write paths in:
  - `src/cli/index.tsx:476`
  - `src/ui/screens/RSVPScreen.tsx` (preview list)
  - `src/ui/screens/GuidedScrollScreen.tsx` (preview list)
- Existing terminal safety pattern in repo uses `sanitizeTerminalText` at output boundaries.

## Proposed Solutions

### Option 1: Sanitize On Every Display/Write

**Approach:** Apply `sanitizeTerminalText` to each phrase at all render/print boundaries.

**Pros:**
- Strong, explicit terminal safety
- Minimal architectural impact

**Cons:**
- Requires touching multiple output points

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Sanitize Once In Flow Layer

**Approach:** Sanitize key phrases in flow/runtime object and treat phrase list as pre-sanitized payload.

**Pros:**
- Centralized behavior

**Cons:**
- Risk of double-sanitization confusion
- Harder to reason about when mixed with non-terminal contexts

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/cli/index.tsx`
- `src/ui/screens/RSVPScreen.tsx`
- `src/ui/screens/GuidedScrollScreen.tsx`

**Related components:**
- Terminal rendering safety
- LLM output handling

**Database changes:**
- No

## Resources

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

## Acceptance Criteria

- [ ] All key phrase list/preview rendering paths sanitize phrase text
- [ ] Added regression test includes malicious control-sequence phrase fixture
- [ ] No visual/control-sequence artifacts appear in terminal output

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Captured terminal-injection risk from security review
- Linked finding to established terminal safety patterns in docs/solutions

**Learnings:**
- LLM output must be treated as untrusted at every output boundary.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Sanitized standalone list output phrases in `src/cli/index.tsx`
- Sanitized preview phrase rendering in `src/ui/screens/RSVPScreen.tsx` and `src/ui/screens/GuidedScrollScreen.tsx`
- Added regression coverage for sanitized output in:
  - `tests/cli/key-phrases-cli-contract.test.ts`
  - `tests/ui/chunked-screen-layout.test.tsx`
  - `tests/ui/guided-scroll-screen-layout.test.tsx`

**Learnings:**
- Boundary sanitization plus tests is the most reliable terminal safety strategy for LLM-derived text.

## Notes

- Keep sanitization strategy consistent with existing error/output paths.
