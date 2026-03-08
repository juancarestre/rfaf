---
module: CLI + Agent Integration
date: 2026-03-08
problem_type: integration_issue
component: pdf-ingestion
symptoms:
  - "PDF parsing limits were enforced too late, allowing expensive parse work before deterministic failure."
  - "Raw-size guard checked after full file read, risking unnecessary memory pressure."
  - "PDF parser loading was eager, adding startup overhead to non-PDF paths."
  - "Agent file ingest exposed message-only failures without stable error codes."
root_cause: integration_contract_drift
resolution_type: code_fix
severity: high
tags: [pdf-ingestion, agent-parity, deterministic-errors, guardrails, timeout, lazy-loading]
related_issues: ["060", "061", "062", "063", "064"]
commits: ["7950b62", "6c80f0d"]
---

# Troubleshooting: PDF Ingestion Hardening (CLI + Agent)

## Problem

PDF ingestion worked on happy paths, but review found contract and runtime hardening gaps across ingest, CLI, and agent surfaces:

In practice, this meant malicious or malformed PDFs could consume CPU and memory before the system rejected them.

- parse-time resource overrun risk before deterministic rejection,
- guardrail ordering that allowed full reads before size rejection,
- parser startup overhead leaking into non-PDF flows,
- and no stable typed agent contract for file ingestion failures.

## Environment

- Runtime: Bun + Ink (TypeScript)
- Surfaces: CLI runtime + agent API runtime
- Area: local file ingestion with plaintext/PDF dispatch
- Date: 2026-03-08

## Symptoms

- Oversized/crafted PDFs could consume resources before extraction limits rejected input.
- Raw-size limits were not authoritative before loading bytes in memory.
- Non-PDF usage could still pay PDF parser initialization costs.
- Agent integrations could break on upstream parser-message drift due to message-only error handling.

## What Did Not Work

**Attempted approach 1:** Post-parse-only extracted text size checks.
- **Why it failed:** too late for malicious or malformed PDFs that trigger expensive parsing work.

**Attempted approach 2:** Reading full file bytes before raw-size validation.
- **Why it failed:** memory cost happens before rejection.

**Attempted approach 3:** Eager parser import in dispatcher path.
- **Why it failed:** unnecessary startup overhead for non-PDF inputs.

**Attempted approach 4:** Agent message-only ingest errors.
- **Why it failed:** brittle contract; parser internals could change user-facing semantics.

## Solution

The fix set implemented coordinated hardening across parser, dispatcher, and agent layers.

Before: checks and errors were partly post-parse and message-based. After: checks are front-loaded, parsing is time-bounded, and errors are code-based and stable.

### 1) Enforce raw-size precheck before full read

- Added metadata precheck before `bytes()` and preserved post-read defensive check.

```ts
// src/ingest/pdf.ts
const rawByteLength = await getRawByteLength(path);
assertInputWithinLimit(rawByteLength, maxRawBytes);

const bytes = await readBytes(path);
assertInputWithinLimit(bytes.length, maxRawBytes);
```

### 2) Add deterministic parse timeout + fallback normalization

- Added timeout race with deterministic `PDF parsing timed out` error.
- Preserved known parser-class mappings and normalized unknown parser failures to `Failed to parse PDF file`.

```ts
// src/ingest/pdf.ts
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("PDF parsing timed out"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
```

### 3) Lazy-load PDF parser only on PDF path

- Switched dispatcher to dynamic import so non-PDF paths avoid loading parser dependency.

```ts
// src/ingest/file-dispatcher.ts
if (isPdfPath(path)) {
  const readPdf =
    options.readPdfFile ??
    (await (options.loadPdfFileReader ?? loadPdfFileReader)());

  return readPdf(path);
}
```

### 4) Add stable agent file-ingest error contract

- Introduced typed `AgentIngestFileError` with stable code enum and deterministic mapping.

```ts
// src/agent/reader-api.ts
export type AgentIngestFileErrorCode =
  | "FILE_NOT_FOUND"
  | "PDF_INVALID"
  | "PDF_ENCRYPTED"
  | "PDF_EMPTY_TEXT"
  | "INPUT_TOO_LARGE"
  | "PDF_PARSE_FAILED";
```

## Verification

Commands run after hardening:

```bash
bun test tests/ingest/pdf.test.ts tests/ingest/file-dispatcher.test.ts tests/agent/reader-api.test.ts
bun test
bun x tsc --noEmit
```

Result: all tests passed, and type checking passed.

Regression coverage added for:

- parse timeout determinism,
- raw-size precheck ordering (before read/parse),
- unknown parser-failure normalization,
- lazy loader behavior for non-PDF vs PDF paths,
- stable agent file-ingest failure-code matrix,
- temp-file cleanup hygiene in PDF ingest tests.

## Why This Works

- **Guardrail order is authoritative**: expensive work starts only after fast boundary checks.
- **Error semantics are deterministic**: parser internals no longer leak as unstable top-level contracts.
- **Parity is explicit**: CLI/ingest behavior and agent error contracts are aligned and test-covered.
- **Performance posture improves**: heavy parser dependency is only loaded when needed.

## Prevention

- Treat guard ordering as contract: `exists -> raw size precheck -> read -> parse timeout -> extract checks`.
- Require deterministic error matrix for every new ingest source (CLI + agent).
- Default heavy optional dependencies to lazy load by route.
- Add injectable seams (`getRawByteLength`, `readBytes`, parser hook) to make pathological cases testable.
- Keep targeted contract tests for parser timeout, oversize inputs, and unknown parser failures.

## Related Issues

- `todos/060-pending-p1-pdf-parse-resource-exhaustion-guardrails.md`
- `todos/061-pending-p2-pdf-raw-size-precheck-before-read.md`
- `todos/062-pending-p2-lazy-load-pdf-parser-non-pdf-paths.md`
- `todos/063-pending-p2-agent-file-ingest-error-contract.md`
- `todos/064-pending-p3-cleanup-pdf-temp-fixture-test-files.md`

## See Also

- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- `docs/plans/2026-03-08-feat-phase-4-subphase-16-pdf-ingestion-plan.md`
- `docs/brainstorms/2026-03-08-rfaf-phase-4-subphase-16-pdf-ingestion-brainstorm.md`
