---
status: complete
priority: p1
issue_id: "095"
tags: [code-review, parity, agent, cli]
dependencies: []
---

# Align Agent Key-Phrases With CLI Surface

Ensure key-phrases behavior is equally available through agent APIs and CLI flows.

## Problem Statement

The current key-phrases feature exposes richer behavior in CLI than in agent surfaces. This breaks agent-native parity and can block agent-driven UX from matching user-visible capabilities.

## Findings

- Agent review found missing list-mode parity for key phrases (`src/agent/reader-api.ts:159`, `src/cli/index.tsx:468`).
- Agent state returns only `keyPhrasesCount` but not phrase content (`src/agent/reader-api.ts:1007`), while CLI displays phrase content.
- Empty-extraction error contract differs between CLI and agent (`src/cli/index.tsx:470`, `src/agent/reader-api.ts:857`).

## Proposed Solutions

### Option 1: Full Command Parity

**Approach:** Add `mode: preview|list` to agent key-phrases command and return phrase payload explicitly in list mode.

**Pros:**
- True CLI/agent parity
- Clear contract for external agent consumers

**Cons:**
- Requires command and test updates

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: State-Only Parity

**Approach:** Keep command shape, but include `keyPhrases: string[]` in agent state and emulate list mode client-side.

**Pros:**
- Smaller API change
- Easier rollout

**Cons:**
- Weaker parity semantics
- Client behavior divergence risk

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `tests/agent/reader-api.test.ts`
- `src/cli/index.tsx`

**Related components:**
- Agent command contract
- CLI key-phrases mode behavior

**Database changes:**
- No

## Resources

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [ ] Agent key-phrases command supports explicit list/preview parity semantics
- [ ] Agent state or command response exposes phrase content, not only count
- [ ] Empty extraction maps to same error class semantics across CLI and agent
- [ ] Tests added/updated for parity paths

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Consolidated parity findings from `agent-native-reviewer`
- Verified CLI vs agent behavior deltas and error-path mismatch
- Drafted parity options with contract scope

**Learnings:**
- Existing repository patterns strongly expect CLI/agent feature parity in same subphase.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added explicit agent key-phrases `mode` contract (`preview|list`) in `src/agent/reader-api.ts`
- Implemented list-mode behavior without read-session mutation in `executeAgentKeyPhrasesCommand`
- Exposed full `keyPhrases` payload in `AgentReaderState` for parity with CLI-visible phrase content
- Added parity coverage in `tests/agent/reader-api.test.ts`

**Learnings:**
- Agent parity is strongest when command semantics mirror CLI modes explicitly.

## Notes

- Treat as merge-blocking until parity path is explicit.
