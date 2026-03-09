---
module: CLI + Agent Integration
date: 2026-03-09
problem_type: integration_issue
component: tooling
symptoms:
  - "Clipboard reads could fail nondeterministically when the primary backend was unavailable."
  - "Unavailable-backend failures were not normalized to one stable ingest error contract."
  - "Async clipboard subprocesses could outlive timeout windows and create hanging ingest paths."
  - "Agent clipboard ingest could duplicate normalized outputs for one request."
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - assistant
tags: [clipboard-ingestion, deterministic-errors, timeout, agent-parity, deduplication]
---

# Troubleshooting: Clipboard Ingestion P1/P2 Contract Hardening

## Problem

Phase 4 Subphase 19 introduced clipboard ingestion, but P1/P2 validation surfaced contract drift across runtime ingest and agent ingestion surfaces. Clipboard backend behavior was not deterministic enough under unavailable backends, timeout paths, and repeated agent ingest calls.

## Environment

- Module: CLI + Agent Integration
- Runtime: Bun + Ink (TypeScript)
- Affected component: Clipboard source ingest and agent ingest mapping
- Stage: Phase 4 Subphase 19 (post-implementation hardening)
- Date solved: 2026-03-09

## Symptoms

- Clipboard backend probing could fail differently by environment instead of collapsing to one unavailable contract.
- Backend-unavailable cases did not always normalize to a stable clipboard-unavailable error class.
- Async subprocess clipboard reads could continue beyond timeout bounds.
- Agent ingest occasionally returned duplicate clipboard payloads for a single ingest request.

## What Was Insufficient

1. Backend probing prioritized happy-path command execution and did not fail closed consistently when no backend was usable.
2. Error normalization relied on partial message/path distinctions and allowed classification drift.
3. Timeout containment did not always enforce a hard upper bound for async subprocess completion.
4. Agent ingest lacked a strict dedup guard at the clipboard ingest boundary.

## Solution

### 1) Harden backend fallback probing

- Added deterministic probe ordering for clipboard backends.
- Fail closed when all backends are unavailable.
- Returned a stable clipboard-unavailable contract instead of backend-specific noise.

### 2) Normalize unavailable errors to one canonical ingest class

- Consolidated unavailable/backend-missing variants into one normalized error path.
- Kept stable code/message semantics for both CLI and agent entry points.

### 3) Add strict async subprocess timeout containment

- Wrapped clipboard subprocess execution with explicit timeout boundaries.
- Ensured timeout cleanup prevents lingering subprocess work from continuing after rejection.

### 4) Deduplicate agent clipboard ingest results

- Added dedup logic so one ingest invocation emits one normalized clipboard payload.
- Prevented duplicate downstream processing and duplicate user-visible ingest effects.

## Verification

Executed and passed:

```bash
bun test
bun x tsc --noEmit
```

Result: clipboard hardening behavior and type safety checks are green.

## Why This Works

- Deterministic probing removes environment-specific backend variance from user-facing contracts.
- Canonical unavailable normalization prevents drift between CLI and agent error handling.
- Timeout containment enforces bounded resource behavior for subprocess-based clipboard reads.
- Agent dedup makes ingest idempotent at the response boundary and eliminates duplicate output artifacts.

## Prevention

- Keep clipboard backend probing deterministic and explicitly ordered.
- Treat unavailable/backends-missing errors as one contract class at ingest boundaries.
- Require timeout + cleanup behavior for all subprocess-based ingestors.
- Add parity tests for CLI and agent ingest whenever source-specific logic changes.

## Related Issues

- Similar guardrail pattern: `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- Similar guardrail pattern: `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
- Similar guardrail pattern: `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`

## See Also

- `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-19-clipboard-support-brainstorm.md`
- `docs/plans/2026-03-09-feat-phase-4-subphase-19-clipboard-support-plan.md`
