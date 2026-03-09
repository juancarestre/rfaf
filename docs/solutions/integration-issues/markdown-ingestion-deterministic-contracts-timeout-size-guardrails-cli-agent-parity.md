---
module: CLI + Agent Integration
date: 2026-03-09
problem_type: integration_issue
component: markdown-ingestion
symptoms:
  - "Raw markdown syntax reduced readability in fast-reading modes."
  - "Markdown ingest needed deterministic failures for binary, empty, timeout, and parse-error cases."
  - "Agent file-ingest mapping risked drift due to message-coupled mapping and implicit markdown binary fallback."
root_cause: integration_contract_drift
resolution_type: code_fix
severity: high
tags: [markdown-ingestion, readability, deterministic-errors, timeout, size-limits, agent-parity]
related_issues: ["066", "067", "068", "070", "069", "071", "072"]
commits: ["3bb4205", "73a3ed9"]
---

# Troubleshooting: Markdown Ingestion Contracts, Guardrails, and CLI/Agent Parity

## Problem

Phase 4 Subphase 18 added markdown support, but markdown required stricter ingestion contracts than plain text. The system needed to deliver readability-first output while preserving deterministic behavior across CLI and agent entry points.

Review surfaced critical hardening gaps:

- The parser path needed stronger runtime bounds.
- Agent mapping was too message-coupled.
- Markdown binary detection needed explicit agent contract mapping.
- Dispatcher tests were becoming duplication-heavy and drift-prone.

## Environment

- Runtime: Bun + Ink (TypeScript)
- Input scope: local `.md` and `.markdown`
- Architecture: source-specific ingestors -> shared `Document` -> common reading pipeline

## Symptoms

- Raw markdown syntax (`#`, fences, links, tables/images) reduced fast-reading comprehension.
- Guardrails needed to fail predictably for malformed/pathological markdown.
- Agent clients required stable source-correct codes for markdown failures.
- Dispatcher test duplication made extension growth harder to maintain.

## What Was Insufficient

1. Treating markdown too close to plaintext (insufficient readability normalization).
2. Error mapping relying primarily on message text (brittle contract over time).
3. Markdown binary-file errors not explicitly represented in agent mapping.
4. Non-table-driven dispatcher tests causing growing maintenance overhead.

## Solution

### 1) Added dedicated markdown ingestor with deterministic normalization

- Preserved heading/list cues.
- Collapsed fenced code blocks to `[code block omitted]`.
- Converted links to text and replaced images and tables with placeholders.

```ts
// src/ingest/markdown.ts
if (isFenceMarker(line)) {
  flushParagraph();
  blocks.push("[code block omitted]");
  inFence = true;
  continue;
}
```

### 2) Added timeout + abort-aware parse containment

```ts
// src/ingest/markdown.ts
const timer = setTimeout(() => {
  controller.abort();
  reject(new IngestFileError("MARKDOWN_PARSE_FAILED", "Markdown parsing timed out"));
}, timeoutMs);
```

### 3) Introduced typed ingest errors for contract stability

```ts
// src/ingest/errors.ts
export type IngestFileErrorCode =
  | "FILE_NOT_FOUND"
  | "INPUT_TOO_LARGE"
  | "BINARY_FILE"
  | "MARKDOWN_EMPTY_TEXT"
  | "MARKDOWN_PARSE_FAILED";
```

### 4) Mapped typed errors first in agent API, with explicit markdown binary code

```ts
// src/agent/reader-api.ts
case "BINARY_FILE":
  if (sourcePath && isMarkdownPath(sourcePath)) {
    return new AgentIngestFileError("MARKDOWN_BINARY", error.message);
  }
```

### 5) Kept routing and startup behavior consistent

- Routed `.md`/`.markdown` through dispatcher markdown branch.
- Kept extension routing case-insensitive and source-detection precedence intact.

## Verification

Executed and passed:

```bash
bun test
bun x tsc --noEmit
```

Result: the full suite is green (400 tests passing).

Targeted coverage includes:

- `tests/ingest/markdown.test.ts`
- `tests/ingest/file-dispatcher.test.ts`
- `tests/ingest/detect.test.ts`
- `tests/cli/markdown-cli-contract.test.ts`
- `tests/cli/markdown-pty-contract.test.ts`
- `tests/agent/reader-api.test.ts`

## Why This Works

- **Contract-first ingest:** markdown has explicit normalization and failure semantics.
- **Bounded parser behavior:** timeout + abort signaling prevents unbounded wait paths.
- **Typed mapping stability:** agent contracts are less brittle than pure message matching.
- **Parity by shared path:** CLI and agent both route through `readFileSource` behavior.

## Prevention

- Keep ingest guard order fixed: exists, raw size, read, binary sniff, bounded parse, extracted size, and empty check.
- Prefer typed ingest errors, then message fallback only for compatibility.
- Add parity tests for every new source across ingest, dispatcher, CLI contract/PTY, and agent mapping.
- Keep parser dependencies lazy-loaded by source route.

## Related Issues

- Completed hardening findings:
  - `todos/066-pending-p1-markdown-parse-performance-and-timeout-guardrails.md`
  - `todos/067-pending-p2-typed-agent-ingest-error-mapping-for-markdown.md`
  - `todos/068-pending-p2-explicit-markdown-binary-file-agent-contract.md`
  - `todos/070-pending-p2-table-driven-file-dispatcher-tests.md`
- Pending follow-ups:
  - `todos/069-pending-p3-markdown-extension-agent-parity-tests.md`
  - `todos/071-pending-p3-shared-path-kind-helper-for-source-types.md`
  - `todos/072-pending-p3-simplify-markdown-cli-piped-stdin-test-helper.md`

## See Also

- `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-18-markdown-readability-brainstorm.md`
- `docs/plans/2026-03-09-feat-phase-4-subphase-18-markdown-readability-ingestion-plan.md`
- `docs/solutions/integration-issues/epub-ingestion-deterministic-guardrails-cli-agent-parity-hardening.md`
- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
