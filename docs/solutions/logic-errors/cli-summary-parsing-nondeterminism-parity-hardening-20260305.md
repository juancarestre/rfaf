---
module: CLI Runtime
date: 2026-03-05
problem_type: logic_error
component: tooling
symptoms:
  - "The same `--summary` command shape could behave differently depending on whether a file existed on disk."
  - "Summarize-then-read capability was available in CLI but not through the agent API surface."
  - "Summary failure paths had hardening gaps around error sanitization, retry behavior, and startup loading costs."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [summary-flow, cli-determinism, agent-parity, retry-bounds, lazy-loading]
---

# Troubleshooting: Summary Flow Nondeterminism and Hardening Gaps

## Problem

After Phase 2 summarize support landed, review found contract-level correctness issues in the new path. The most critical was non-deterministic `--summary` parsing based on filesystem state. Additional gaps affected agent parity, runtime output safety, retry policy, and startup performance.

## Environment

- Module: CLI Runtime
- Affected Component: CLI parser + summarize pipeline + agent reader API
- Date: 2026-03-05

## Symptoms

- `--summary <token>` could be interpreted differently depending on local file existence.
- Agent users could not trigger summarize-then-read even though CLI users could.
- Runtime/provider error text could propagate with unsafe terminal content in failure paths.
- Retry behavior for transient failures could be too aggressive (no backoff) and config bounds were too loose.

## What Didn't Work

**Attempted Solution 1:** Resolve `--summary` ambiguity with filesystem probing (`existsSync`) in arg normalization.
- **Why it failed:** Parsing became environment-dependent instead of argv-dependent, violating deterministic CLI contract behavior.

**Attempted Solution 2:** Keep summary capability scoped to CLI only.
- **Why it failed:** Agent-native parity expectation was violated for a user-visible capability.

**Attempted Solution 3:** Rely on partial sanitization/redaction and immediate retries.
- **Why it failed:** Did not fully protect terminal output boundaries and could amplify transient provider failures.

## Solution

Implemented a focused hardening pass across P1/P2 findings:

- Removed filesystem-dependent parsing from `--summary` normalization.
- Added summarize parity to agent API (`executeAgentSummarizeCommand`) and exposed summary context in agent state.
- Sanitized final CLI error output at the terminal boundary.
- Added bounded config validation for summarize timeout/retries.
- Added retry backoff+jitter for transient errors.
- Lazy-loaded summarize flow so non-summary runs avoid eager AI SDK load.
- Ensured timeout/listener/interval cleanup paths are explicit and reliable.

**Code changes (key snippets):**

```ts
// src/cli/index.tsx
// Deterministic argv-only normalization for unknown token after --summary
normalized.push("--summary=");

// Lazy load summarize flow only when enabled
const summaryResult = summaryOption.enabled
  ? await (async () => {
      const { summarizeBeforeRsvp } = await import("./summarize-flow");
      return summarizeBeforeRsvp({ documentContent, sourceLabel, summaryOption });
    })()
  : { readingContent: document.content, sourceLabel: document.source };
```

```ts
// src/config/llm-config.ts
export const MAX_SUMMARIZE_TIMEOUT_MS = 60_000;
export const MAX_SUMMARIZE_RETRIES = 5;
```

```ts
// src/llm/summarize.ts
await sleep(getRetryDelayMs(attempt)); // exponential backoff + jitter
```

**Validation/tests updated:**

- `tests/cli/summary-cli-contract.test.ts`
- `tests/agent/reader-api.test.ts`
- `tests/config/llm-config.test.ts`

**Commands run:**

```bash
bun test
bun x tsc --noEmit
```

Both passed after fixes.

## Why This Works

The root issue was contract drift at multiple boundaries (parser, parity surface, runtime safeguards). The fix re-established explicit boundaries:

1. **Deterministic parse boundary**: parsing uses argv semantics, not filesystem state.
2. **Parity boundary**: summarize capability is exposed to both CLI and agent interfaces.
3. **Safety boundary**: final rendered errors are sanitized/redacted before terminal output.
4. **Failure-policy boundary**: retries are bounded and controlled; timeout/retry config is clamped.
5. **Performance boundary**: summarize stack is loaded only when needed.

## Prevention

- Never perform filesystem probing during option normalization.
- Require explicit contract tests for ambiguous CLI forms (`--summary`, `--summary=<preset>`, unknown token handling).
- Enforce final-output sanitization/redaction at terminal write boundaries.
- Keep retry policy bounded with backoff+jitter and strict transient-only retry rules.
- Use lazy imports for optional heavy feature paths.
- For any new CLI-visible capability, add agent parity decision and tests in the same change.

## Related Issues

- Runtime hardening baseline: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- Summarize PTY validation: `docs/validation/2026-03-05-acceptance-pty.md`
- Related review-fix commit: `1cb47a2`
