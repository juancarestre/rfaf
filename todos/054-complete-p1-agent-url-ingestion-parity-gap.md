---
status: complete
priority: p1
issue_id: "054"
tags: [code-review, parity, agent-api, architecture]
dependencies: []
---

# Add Agent URL Ingestion Parity

CLI now supports URL ingestion, but agent workflows cannot trigger the same capability.

## Problem Statement

Users can run `rfaf https://...` in CLI, but agent APIs currently require pre-tokenized words and have no URL ingest entrypoint. This violates agent-native parity expectations and creates feature drift between user and agent interfaces.

## Findings

- `src/cli/index.tsx:248` uses URL path via `readUrl`.
- `src/ingest/detect.ts:20` resolves URL input source.
- `src/agent/reader-api.ts:70` command surface lacks URL ingest command.
- Agent review marked this as parity gap for newly shipped feature.
- Known pattern: parity hardening expected when adding CLI-visible behavior (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).

## Proposed Solutions

### Option 1: Add `ingest_url` Agent Command

**Approach:** Add a new agent command that accepts URL + options, calls shared ingest path, then initializes/updates runtime content.

**Pros:**
- Full parity with CLI feature
- Reuses hardened URL ingest behavior

**Cons:**
- Expands agent command surface
- Requires new tests for command lifecycle

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 2: Add Generic `ingest_input` Agent Command

**Approach:** Single command supports file/stdin/url forms, mirroring CLI source resolver behavior.

**Pros:**
- Future-proof for additional source types
- Single parity point across inputs

**Cons:**
- More design work now
- Risk of over-abstraction for MVP

**Effort:** 6-10 hours

**Risk:** Medium

---

### Option 3: Explicitly Document as Non-Goal (Temporary)

**Approach:** Keep CLI-only feature for now, add clear doc and tests asserting agent does not support URL yet.

**Pros:**
- Fastest short-term
- Avoids accidental partial implementation

**Cons:**
- Keeps parity gap open
- Higher future migration cost

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Implemented Option 1 by adding an explicit agent URL ingest entrypoint that reuses the shared URL ingestor and returns initialized runtime metadata.

## Technical Details

**Affected files:**
- `src/agent/reader-api.ts`
- `src/ingest/url.ts`
- `tests/agent/reader-api.test.ts`
- Potential new agent contract tests

**Related components:**
- CLI source resolution and ingest path
- Agent runtime command dispatch

**Database changes:**
- No

## Resources

- **PR:** https://github.com/juancarestre/rfaf/pull/1
- **Reference doc:** `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- **Review source:** agent-native-reviewer findings

## Acceptance Criteria

- [x] Agent can ingest URL content via explicit command OR parity gap is formally documented and tested as intentional
- [x] Behavior (errors, limits, sanitization) matches CLI ingest contracts
- [x] Agent tests cover happy path and failure paths
- [x] No regressions in existing agent reading controls

## Work Log

### 2026-03-07 - Code Review Finding Created

**By:** OpenCode

**Actions:**
- Consolidated parity findings from agent-native review
- Mapped CLI URL ingest entrypoints vs missing agent command surface
- Linked to prior parity hardening guidance

**Learnings:**
- URL ingest is the first clear source-capability divergence between CLI and agent flows in this phase

### 2026-03-08 - Resolved

**By:** OpenCode

**Actions:**
- Added `executeAgentIngestUrlCommand()` in `src/agent/reader-api.ts`.
- Reused shared `readUrl()` ingest path and tokenization to create runtime parity with CLI URL ingestion.
- Added agent tests for URL ingest happy path, option passthrough, and invalid mode fail-closed behavior in `tests/agent/reader-api.test.ts`.

**Learnings:**
- A dedicated async ingest API provides parity without forcing async semantics into synchronous runtime command dispatch.

## Notes

- P1 because parity is a stated project quality requirement for user-visible features.
