---
module: CLI + Agent Integration
date: 2026-03-08
problem_type: integration_issue
component: url-ingestion
symptoms:
  - "Long URL loading messages wrapped in TTY and rendered as multiline spinner artifacts."
  - "Agent surface had no URL ingest entrypoint while CLI supported `rfaf https://...`."
  - "URL response size enforcement relied on `Content-Length` and could buffer oversized payloads when headers were missing or wrong."
  - "Timeout/cancel classification used message substring heuristics, allowing false positives and nondeterministic errors."
root_cause: integration_contract_drift
resolution_type: code_fix
severity: high
tags: [url-ingestion, agent-parity, deterministic-errors, boundary-hardening, tty]
related_issues: ["054", "055", "056", "057"]
commits: ["949cf87", "2a33493"]
---

# Troubleshooting: URL Ingestion Integration Hardening (CLI + Agent)

## Problem

URL ingestion shipped for CLI, but follow-up validation exposed cross-surface contract gaps and boundary-hardening issues:

- terminal loading UX degraded with long URLs,
- agent users could not invoke equivalent URL ingestion,
- response-size limits were not authoritative without trustworthy headers,
- and timeout/cancel error mapping was heuristic instead of deterministic.

The feature worked on happy paths, but behavior diverged under real-world edge cases and large/hostile responses.

## Environment

- Runtime: Bun + Ink (TypeScript)
- Surfaces: CLI runtime + agent API runtime
- Area: URL ingestion (`http://` / `https://`) using `fetch` + `@mozilla/readability` + `linkedom`
- Date: 2026-03-08

## Symptoms

- Running with long URLs produced wrapped spinner output that looked like repeated multiline logs.
- CLI users could ingest URLs, but agent runtime had no equivalent command.
- With missing or inaccurate `Content-Length`, oversized responses could still be fully buffered before rejection.
- URLs containing words like `timeout` or `abort` could trigger incorrect timeout/cancel classification.

## What Did Not Work

**Attempted approach 1:** Header-only response size pre-check.
- **Why it failed:** metadata is optional/unreliable; authoritative byte limits must be enforced on the real payload stream.

**Attempted approach 2:** Error classification from `message.includes("timeout")` / `includes("abort")`.
- **Why it failed:** brittle and nondeterministic when user-provided URLs or upstream messages contain those strings.

**Attempted approach 3:** CLI-first feature without explicit agent parity surface.
- **Why it failed:** functionality drifted between two supported interaction surfaces.

## Solution

The fix set applied four coordinated changes.

### 1) Keep spinner output single-line in TTY

- Added width-aware truncation for loading messages so long URLs do not wrap and corrupt redraw behavior.

```ts
// src/cli/loading-indicator.ts
const columns = stream.columns ?? 80;
const maxMessageLength = Math.max(1, columns - 3);
const singleLineMessage = truncateSingleLine(safeMessage, maxMessageLength);
stream.write(`\r${frame} ${singleLineMessage}`);
```

### 2) Add agent URL-ingest parity entrypoint

- Added `executeAgentIngestUrlCommand` so agents can ingest URLs through the same hardened `readUrl` path and initialize runtime consistently.

```ts
// src/agent/reader-api.ts
export async function executeAgentIngestUrlCommand(command, readUrlFn = readUrl) {
  const readingMode = command.readingMode ?? DEFAULT_READING_MODE;
  const document = await readUrlFn(command.url, command.readUrlOptions);
  const runtime = createAgentReaderRuntime(
    tokenize(document.content),
    command.initialWpm ?? 300,
    command.textScale ?? DEFAULT_TEXT_SCALE,
    readingMode
  );
  return { runtime, sourceLabel: document.source, wordCount: document.wordCount };
}
```

### 3) Enforce `maxResponseBytes` on streamed payload bytes

- Replaced full-buffer `response.text()` read path with streamed byte counting.
- Kept `Content-Length` pre-check as a fast path, but stream byte count is now authoritative.

```ts
// src/ingest/url.ts
const payload = await readResponseTextWithinLimit(response, maxResponseBytes, url);

if (bytesRead > maxResponseBytes) {
  await reader.cancel().catch(() => {});
  throw new Error(`Response too large from ${url}`);
}
```

### 4) Make timeout/cancel classification signal-driven

- Removed message-substring heuristics.
- Classification now follows explicit signal state and known abort error type.

```ts
// src/ingest/url.ts
if (timeoutSignal.aborted) {
  throw new Error(`Timed out fetching ${url} (${formatTimeoutLabel(timeoutMs)} limit)`);
}

if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
  throw new Error(`Fetching ${url} cancelled`);
}
```

## Verification

Commands run after fixes:

```bash
bun test tests/ingest/url.test.ts tests/agent/reader-api.test.ts
bun test
bun x tsc --noEmit
```

Result: passing tests and strict TypeScript checks.

Added regression coverage for:

- long spinner messages in constrained TTY width,
- agent URL ingest happy path + fail-closed invalid mode,
- oversized response with missing `Content-Length`,
- URL strings containing `timeout` / `abort` no longer remapping HTTP failures,
- timeout message reflecting configured `timeoutMs`.

## Why This Works

- **Boundary enforcement moved to truth source**: payload bytes, not optional headers.
- **Error semantics became explicit**: signal-state-based mapping prevents text-driven false positives.
- **Cross-surface parity is enforced in code**: agent and CLI both use shared URL ingest logic.
- **Terminal UX honors display constraints**: spinner output is now width-aware.

## Prevention

- Treat terminal status lines as constrained UI: sanitize and truncate dynamic values.
- For remote inputs, enforce limits on streamed bytes even when metadata exists.
- Do not classify failures from free-form error text; use typed/signal-based branches.
- For every CLI-visible capability, either ship agent parity in the same change or explicitly document and test non-goal status.
- Keep PTY tests for rendering contracts and integration tests for edge-case ingest boundaries.

## Related Issues

- Completed review follow-ups:
  - `todos/054-complete-p1-agent-url-ingestion-parity-gap.md`
  - `todos/055-complete-p2-url-response-byte-limit-enforcement.md`
  - `todos/056-complete-p2-url-error-classification-determinism.md`
  - `todos/057-complete-p3-timeout-message-respects-timeoutms.md`
- Remaining optional follow-ups:
  - `todos/058-pending-p3-url-redaction-and-single-line-terminal-safety.md`
  - `todos/059-pending-p3-url-ingest-hot-path-simplification.md`

## See Also

- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
