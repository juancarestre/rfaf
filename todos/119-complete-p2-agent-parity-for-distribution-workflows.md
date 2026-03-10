---
status: complete
priority: p2
issue_id: "119"
tags: [code-review, agent-native, parity, release]
dependencies: []
---

# Add Agent Parity for Distribution and Release Workflows

## Problem Statement

Users can run compile/checksum workflows through CLI scripts, but agent surfaces currently have no equivalent capability. This creates user-agent parity gaps for release-critical operations.

## Findings

- New scripts expose `build:compile`, `build:compile:current`, and `release:checksums` in `package.json`.
- No agent API/tooling path exists for compile/checksum execution or release validation checklist orchestration.
- Agent-native reviewer flagged this as capability mismatch.

## Proposed Solutions

### Option 1: Add Agent Tools for Build + Integrity Flows (Recommended)

**Approach:** Expose compile and checksum generation as agent-accessible operations with deterministic outputs.

**Pros:**
- Restores user-agent parity for release flow.
- Enables automated agent-driven validation workflows.

**Cons:**
- Requires API/tooling surface expansion and tests.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Document CLI-Only Scope Explicitly

**Approach:** Keep capability CLI-only for now and track parity debt explicitly.

**Pros:**
- No immediate implementation overhead.

**Cons:**
- Leaves cross-surface inconsistency.

**Effort:** Small

**Risk:** Medium

## Recommended Action

Implemented Option 1 by adding agent-accessible distribution commands for compile and checksum workflows with deterministic outputs.

## Technical Details

**Affected files:**
- `package.json`
- `src/agent/reader-api.ts`
- distribution/release docs

## Resources

- Known Pattern: `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`

## Acceptance Criteria

- [x] Agent surface can trigger compile workflow with deterministic parameterization.
- [x] Agent surface can trigger checksum/manifest generation and return structured results.
- [x] Parity tests verify equivalent capabilities across user and agent workflows.

## Work Log

### 2026-03-10 - Initial Discovery

**By:** OpenCode

**Actions:**
- Captured agent-native review parity gaps introduced by distribution scripts.

**Learnings:**
- Release workflows are high-value parity surfaces for agent-native reliability.

### 2026-03-10 - Resolution

**By:** OpenCode

**Actions:**
- Added `src/agent/distribution-api.ts` with:
  - `executeAgentCompileDistributionCommand(...)`
  - `executeAgentReleaseChecksumsCommand(...)`
- Added parity coverage in `tests/agent/distribution-api.test.ts`.

**Learnings:**
- Providing deterministic, structured agent wrappers for release scripts closes parity gaps without changing user CLI contracts.
