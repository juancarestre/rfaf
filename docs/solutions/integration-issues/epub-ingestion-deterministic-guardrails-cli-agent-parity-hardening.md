---
module: CLI + Agent Integration
date: 2026-03-09
problem_type: integration_issue
component: epub-ingestion
symptoms:
  - "EPUB chapter output could include HTML markup instead of clean reader text."
  - "Extracted-size enforcement happened too late, after full accumulation."
  - "Timeout errors were deterministic but parse work could continue without cooperative abort checks."
  - "Unknown EPUB agent ingest failures could fall back to PDF parse error codes."
root_cause: integration_contract_drift
resolution_type: code_fix
severity: high
tags: [epub-ingestion, deterministic-errors, guardrails, timeout, agent-parity, lazy-loading]
related_issues: ["060", "061", "062", "063", "064", "065"]
commits: ["f8c057d", "c07b275"]
---

# Troubleshooting: EPUB Ingestion Guardrails and CLI/Agent Parity

## Problem

Phase 4 Subphase 17 added EPUB ingestion, but review surfaced contract gaps across ingest, CLI, and agent surfaces:

- chapter text extraction could preserve markup,
- extracted-size limits were enforced too late,
- timeout behavior lacked cooperative containment,
- and agent fallback classification could drift from source type.

This was a non-trivial integration issue because behavior had to remain predictable across multiple entry points (`rfaf <file>` and agent `ingest_file`) while preserving existing ingest contracts.

## Environment

- Runtime: Bun + Ink (TypeScript)
- Source scope: local `.epub` files only
- Parser: `epub2`
- Architecture: source-specific ingestors -> shared `Document` -> common reading pipeline

## Symptoms

- Reader content risked showing raw tags like `<p>` on EPUB content.
- Oversized extracted content could allocate too much before deterministic rejection.
- `EPUB parsing timed out` could be returned while parser work still progressed.
- Unmapped EPUB failures could appear as `PDF_PARSE_FAILED` in agent API.

## What Was Insufficient

1. Late post-parse size checks only.
2. Whitespace normalization without explicit HTML-to-text extraction.
3. The parser loop did not check an abort signal, so parse work could continue after timeout.
4. Source-agnostic agent fallback mapping.

## Solution

### 1) Extract plain text from chapter HTML before normalization

```ts
// src/ingest/epub.ts
function extractChapterText(chapterContent: string): string {
  const { document } = parseHTML(chapterContent);
  const bodyText = document.body?.textContent?.trim();
  const documentText = document.documentElement?.textContent?.trim();
  const text = bodyText || documentText || chapterContent;
  return normalizeSectionText(text);
}
```

### 2) Enforce extracted-size budget incrementally during chapter accumulation

```ts
// src/ingest/epub.ts
const separatorBytes = sections.length === 0 ? 0 : 2;
const chapterBytes = Buffer.byteLength(normalized, "utf8");
totalExtractedBytes += separatorBytes + chapterBytes;
assertInputWithinLimit(totalExtractedBytes, maxExtractedBytes);
sections.push(normalized);
```

### 3) Add timeout containment via abort signal and cooperative checks

```ts
// src/ingest/epub.ts
const controller = new AbortController();
setTimeout(() => {
  controller.abort();
  reject(new Error("EPUB parsing timed out"));
}, timeoutMs);

if (signal?.aborted) {
  throw new Error("EPUB parsing timed out");
}
```

### 4) Keep agent fallback classification source-aware

```ts
// src/agent/reader-api.ts
if (sourcePath && isEpubPath(sourcePath)) {
  return new AgentIngestFileError("EPUB_PARSE_FAILED", "Failed to parse EPUB file");
}
return new AgentIngestFileError("PDF_PARSE_FAILED", "Failed to parse PDF file");
```

### 5) Preserve route-level startup performance and parity

- Dispatcher remains extension-routed and lazy-loaded for heavy parsers.
- CLI and agent both ingest EPUB through the shared file source path.

## Verification

Executed and passed:

```bash
bun test
bun x tsc --noEmit
```

EPUB-specific and parity coverage includes:

- `tests/ingest/epub.test.ts` (markup stripping, deterministic errors, incremental guardrails, timeout abort behavior)
- `tests/ingest/file-dispatcher.test.ts` (EPUB routing + lazy-loading)
- `tests/cli/epub-cli-contract.test.ts`
- `tests/cli/epub-pty-contract.test.ts`
- `tests/agent/reader-api.test.ts` (EPUB mapping + source-aware fallback)

Final status after implementation: full suite green (`380` passing tests).

## Why This Works

- **Guardrails are authoritative in the hot path**: limits are enforced before expensive full accumulation.
- **Text contract is explicit**: chapter HTML is converted to plain reader text.
- **Timeout semantics include containment**: abort is signaled and checked during parsing.
- **Parity remains stable**: CLI and agent share the same ingest path, and fallback codes match source type.

## Prevention

- Treat ingest guard order as a contract for every new source.
- Require source-specific deterministic fallback codes in agent mappings.
- Add timeout + abort behavior tests for parser integrations.
- Keep heavy parsers lazy-loaded by route.
- Add contract tests that assert plain text output (not parser intermediates).

## Related Issues

- `todos/060-pending-p1-epub-extracted-size-guard-before-accumulation.md`
- `todos/061-pending-p1-epub-strip-html-markup-before-reading.md`
- `todos/062-pending-p2-agent-epub-fallback-error-code-parity.md`
- `todos/063-pending-p2-epub-parse-timeout-resource-containment.md`
- Follow-up maintainability items:
  - `todos/064-pending-p3-deduplicate-epub-pdf-cli-test-harnesses.md`
  - `todos/065-pending-p3-normalize-newlines-in-terminal-source-labels.md`

## See Also

- `docs/brainstorms/2026-03-09-rfaf-phase-4-subphase-17-epub-ingestion-brainstorm.md`
- `docs/plans/2026-03-09-feat-phase-4-subphase-17-epub-ingestion-plan.md`
- `docs/solutions/integration-issues/pdf-ingestion-cli-agent-parity-runtime-guardrails.md`
- `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
