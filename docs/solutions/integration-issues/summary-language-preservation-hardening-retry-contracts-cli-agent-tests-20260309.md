---
module: CLI + Agent Integration
date: 2026-03-09
problem_type: integration_issue
component: tooling
symptoms:
  - "`--summary` could return English output even when the source content was in a different language."
  - "Language drift was nondeterministic and surfaced across both CLI and agent summarize entry points."
  - "Failure behavior around language-preservation retries did not enforce a strict deterministic contract."
root_cause: integration_contract_drift
resolution_type: code_fix
severity: high
related_components:
  - assistant
tags: [summary-flow, language-preservation, retry-policy, deterministic-failures, cli-agent-parity]
---

# Troubleshooting: Summary Language Preservation Drift in `--summary`

## Problem

`--summary` occasionally translated non-English source input into English. The issue was intermittent, which made behavior feel random and broke the expectation that summarize output should preserve the source language unless explicitly requested otherwise.

## Environment

- Module: CLI + Agent Integration
- Runtime: Bun + Ink (TypeScript)
- Affected component: Summarize prompt + summarize runtime validation/retry path
- Stage: Post-implementation hardening for summarize contracts
- Date solved: 2026-03-09

## Symptoms

- Non-English inputs could produce English summaries without user intent.
- CLI and agent summarize surfaces could both exhibit the same language drift.
- Retry and failure outcomes were not explicit enough for deterministic contract testing.

## What Was Insufficient

1. Prompt constraints were too soft about preserving input language.
2. Runtime validation did not strongly enforce language-preservation expectations.
3. Retry/failure behavior did not fully codify deterministic outcomes when preservation checks failed.

## Solution

### 1) Harden summarize prompt language contract

- Strengthened prompt instructions so output language must match input language by default.
- Clarified translation is disallowed unless explicitly requested.

### 2) Add runtime language-preservation guard

- Introduced a runtime guard that checks whether summary language matches source language expectations.
- Triggered bounded retry when guard detects drift.

### 3) Make retry/failure contracts deterministic

- Formalized retry behavior and terminal failure conditions for language-preservation violations.
- Ensured stable error semantics when retries are exhausted.

### 4) Add CLI/agent regression coverage

- Added regression tests to lock language-preserving behavior for CLI summarize flows.
- Added agent-side regression tests to preserve parity with CLI behavior.

## Verification

Executed and passed:

```bash
bun test
bun x tsc --noEmit
```

Result: summarize language preservation now follows deterministic retry/failure contracts across CLI and agent surfaces.

## Why This Works

- Prompt hardening reduces model ambiguity at generation time.
- Runtime guard catches residual model drift that prompt-only controls cannot eliminate.
- Bounded deterministic retries provide recovery without unbounded flakiness.
- Shared regression coverage keeps CLI and agent summarize behavior aligned over time.

## Prevention

- Treat language preservation as a first-class summarize contract, not a best-effort preference.
- Pair prompt constraints with runtime validation for model-behavior invariants.
- Keep retry semantics explicit, bounded, and test-backed.
- Add parity tests whenever summarize contract logic changes.

## Related Issues

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
