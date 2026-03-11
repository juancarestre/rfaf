---
module: System
date: 2026-03-11
problem_type: integration_issue
component: tooling
symptoms:
  - "Long-input transforms failed with deterministic timeout errors like 'Summarization failed [timeout]: request timed out.'"
  - "Timeout behavior diverged across transforms and between CLI and agent interfaces."
  - "Non-interactive timeout recovery defaulted to continue, enabling fail-open behavior in automation."
  - "Interactive timeout recovery could block waiting for prompt input with no bounded timeout."
  - "Continue paths could still emit failure-style status lines before recovery decision."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [timeout-reliability, cli-agent-parity, fail-closed, deterministic-recovery, llm-transforms]
---

# Troubleshooting: Unified Timeout Reliability and CLI-Agent Parity Hardening

## Problem

Timeout handling for LLM transforms was partially unified, but follow-up review found critical behavior gaps: non-interactive recovery was fail-open, agent interfaces lacked equivalent timeout continuation behavior, and some recovery/logging paths were inconsistent. This caused reliability and parity drift under long-input workloads.

## Environment

- Module: System-wide (CLI + agent transform pipeline)
- Affected Component: Timeout/retry contracts and recovery orchestration for summarize/no-bs/translate/key-phrases
- Date: 2026-03-11
- PR/commits: `https://github.com/juancarestre/rfaf/pull/3`, commits `323d47b`, `1ebbdf2`, merge `4cb615d`

## Symptoms

- Long-input runs produced typed timeout failures such as `Summarization failed [timeout]: request timed out.`
- Translate/key-phrases timeout semantics diverged from summarize/no-bs global deadline behavior.
- Non-interactive execution continued without transform by default after timeout.
- Recovery prompt could wait indefinitely in interactive sessions.
- Continue outcomes could still emit failure status first, producing contradictory operator signals.

## What Didn't Work

**Attempted Solution 1:** Initial timeout-unification pass (commit `323d47b`) added adaptive timeout policy and recovery wiring.
- **Why it failed:** It did not close P1/P2 contract gaps: non-interactive fail-open default, missing agent timeout recovery parity, logging order inconsistency, unbounded prompt wait, and chunk-wave under-budgeting in translation.

**Attempted Solution 2:** Rely on flow-local behavior without explicit policy controls.
- **Why it failed:** Policy drift persisted across interfaces and modes; behavior remained implicit rather than contract-driven.

## Solution

Applied focused hardening in commit `1ebbdf2` and merged to `main` via `4cb615d`:

1. **Fail-closed default for non-interactive timeout recovery**
   - `src/cli/timeout-recovery.ts`
   - Default non-interactive outcome changed to `abort` unless explicit opt-in (`RFAF_TIMEOUT_CONTINUE=1`).

2. **Bounded interactive recovery prompt + deterministic abort fallback**
   - `src/cli/timeout-recovery.ts`
   - Added prompt timeout (30s default) and catch-path abort semantics.

3. **Timeout continue path logging/order fix**
   - `src/cli/summarize-flow.ts`
   - `src/cli/no-bs-flow.ts`
   - `src/cli/translate-flow.ts`
   - `src/cli/key-phrases-flow.ts`
   - Recovery decision now occurs before failure status emission; continue path emits warning and returns fallback without `loading.fail(...)`.

4. **SIGINT prompt safety**
   - Same flow files as above
   - Removed transform SIGINT listener before entering recovery prompt; ensured deterministic cleanup.

5. **Agent parity for timeout recovery outcomes**
   - `src/agent/reader-api.ts`
   - Added `timeoutOutcome?: "continue" | "abort"` support for summarize/no-bs/translate/key-phrases commands.

6. **Translate chunk-wave-aware timeout budget**
   - `src/cli/translate-flow.ts`
   - `src/agent/reader-api.ts`
   - Budget now scales by chunk waves on top of byte-tier adaptive timeout (with hard cap).

7. **Retry backoff clamped to remaining budget**
   - `src/llm/summarize.ts`
   - `src/llm/no-bs.ts`
   - `src/llm/translate.ts`
   - `src/llm/key-phrases.ts`
   - Added guard so retries do not waste final deadline on sleep.

**Code changes (representative):**
```ts
// BEFORE: non-interactive fail-open
if (!input.isInteractive) return "continue";

// AFTER: fail-closed by default with explicit opt-in continue
if (!input.isInteractive) {
  return input.allowNonInteractiveContinue ? "continue" : "abort";
}
```

```ts
// BEFORE: mark failure before timeout recovery decision
loading.stop();
loading.fail("summarization failed");

// AFTER: resolve timeout outcome first, fail only on abort path
if (error.stage === "timeout") {
  const outcome = await resolveTimeoutOutcome(...);
  if (outcome === "continue") {
    loading.stop();
    writeWarning("[warn] summary timed out; continuing without summary transform");
    return fallback;
  }
}
loading.stop();
loading.fail("summarization failed");
```

## Why This Works

The fix converts timeout behavior from implicit branch drift into an explicit, bounded policy:

1. **Root cause:** logic-level contract drift across mode/interface boundaries (non-interactive CLI, interactive CLI, agent API, and chunked translation path).
2. **Correction:** normalize timeout outcomes and budgets into deterministic contracts (fail-closed default, explicit continue opt-in, bounded prompt wait, parity APIs, chunk-aware budgeting, and budget-aware retries).
3. **Result:** all transform paths now enforce explicit timeout outcomes with predictable logs/exit behavior and aligned CLI-agent semantics.

## Verification

- `bun test` -> `710 pass`, `0 fail`
- `bun x tsc --noEmit` -> pass
- Targeted timeout/parity suites passed:
  - `tests/llm/timeout-policy-contract.test.ts`
  - `tests/llm/timeout-budget-tier-boundary.test.ts`
  - `tests/llm/timeout-outcome-contract.test.ts`
  - `tests/cli/summary-cli-contract.test.ts`
  - `tests/cli/*flow*.test.ts`
  - `tests/agent/reader-api.test.ts`

## Prevention

- Keep timeout handling as explicit state machine (`success` / `continue` / `abort`), never implicit fall-through.
- Require fail-closed defaults for non-interactive automation unless user explicitly opts into degrade behavior.
- Keep CLI and agent parity tests for every transform when adding new recovery behavior.
- Clamp retry sleep to remaining budget and skip retries when remaining deadline is below guard.
- Require bounded waits for all interactive prompts in runtime/error paths.
- Require chunk-wave budget tests for chunked transforms under large-input scenarios.
- Treat `RFAF_TIMEOUT_CONTINUE=1` and agent `timeoutOutcome: "continue"` as explicit fail-open controls; avoid setting them globally in CI unless intended.

## Related Issues

- See also: `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- See also: `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- See also: `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- See also: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
