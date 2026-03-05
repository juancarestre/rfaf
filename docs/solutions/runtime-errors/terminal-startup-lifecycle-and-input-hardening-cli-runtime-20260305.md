---
module: CLI Runtime
date: 2026-03-05
problem_type: runtime_error
component: tooling
symptoms:
  - "Terminal could remain in alternate screen or with hidden cursor when startup failed."
  - "Untrusted content could inject ANSI/OSC escape sequences into rendered UI text."
  - "Large file/stdin inputs were accepted without a byte ceiling, risking memory pressure."
root_cause: missing_tooling
resolution_type: code_fix
severity: high
related_components:
  - development_workflow
  - documentation
tags: [terminal-lifecycle, ansi-injection, input-size-limit, cli-safety, tdd]
---

# Troubleshooting: Terminal Startup Lifecycle and Input Hardening

## Problem

During MVP hardening, the CLI had a startup failure path that could leave terminal state dirty, and it rendered user-controlled strings without sanitization. In parallel, ingestion accepted unbounded input sizes, creating avoidable memory-risk behavior.

## Environment

- Module: CLI Runtime
- Runtime: Bun + Ink (TypeScript)
- Affected Component: CLI orchestration and terminal rendering boundaries
- Date solved: 2026-03-05

## Symptoms

- Terminal sometimes remained in alternate screen or hidden-cursor state if startup failed early.
- ANSI/OSC payloads in input text or labels could flow into terminal output unfiltered.
- Large stdin/file payloads were fully buffered with no explicit size cap.

## What Didn't Work

**Attempted pattern 1: Cleanup scoped only around `waitUntilExit`**
- **Why it failed:** if startup failed before entering the wait loop, terminal restore logic could be skipped.

**Attempted pattern 2: Render raw strings directly in UI components**
- **Why it failed:** rendering untrusted text directly in terminal contexts allows control-sequence injection risks.

**Attempted pattern 3: Rely on normal file sizes in practice**
- **Why it failed:** no explicit ceiling means pathological or accidental large inputs can trigger excessive memory usage.

## Solution

1. Added a single lifecycle wrapper that guarantees cleanup and terminal restoration on all startup paths.
2. Added centralized terminal text sanitization and applied it at rendering boundaries.
3. Added shared ingest byte-limit guards and enforced them for file and stdin ingestion.

**Code changes**:

```ts
// src/cli/session-lifecycle.ts
try {
  if (!input.stdin) {
    throw new Error("Interactive terminal input is required to run rfaf. Please run in a TTY terminal.");
  }

  if (options.useAlternateScreen) {
    options.enterAlternateScreen();
    enteredAlternateScreen = true;
  }

  const app = options.renderApp(input.stdin);
  await app.waitUntilExit();
} finally {
  input.cleanup();
  if (enteredAlternateScreen) {
    options.exitAlternateScreen();
  }
}
```

```ts
// src/ui/sanitize-terminal-text.ts
export function sanitizeTerminalText(value: string): string {
  return value
    .replace(ANSI_OSC_SEQUENCE, "")
    .replace(ANSI_CSI_SEQUENCE, "")
    .replace(CONTROL_CHARS, "");
}
```

```ts
// src/ingest/constants.ts
export const DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024;

export function assertInputWithinLimit(byteLength: number, maxBytes: number): void {
  if (byteLength > maxBytes) {
    throw new Error("Input exceeds maximum supported size");
  }
}
```

**Verification commands**:

```bash
bun test
bun x tsc --noEmit
```

## Why This Works

The lifecycle wrapper moves all risky startup steps under one outer `try/finally`, so cleanup runs even if render initialization throws. Sanitization is centralized and reused by both word rendering and status labels, blocking escape-sequence payloads from user-controlled text. Input-size checks fail fast before heavy processing, capping memory exposure for large payloads.

## Prevention

- Keep terminal lifecycle ownership centralized in `src/cli/session-lifecycle.ts`.
- Sanitize all user-controlled text before rendering in terminal UI components.
- Enforce ingest limits in every new input path via `assertInputWithinLimit`.
- Maintain PTY/integration coverage for startup, resize, Ctrl+C, and quit behavior.
- Treat terminal lifecycle and ingestion files as high-scrutiny areas during code review.

## Related Issues

- Implementation and tracking:
  - `../../../todos/001-pending-p1-terminal-restore-on-startup-failure.md`
  - `../../../todos/002-pending-p2-terminal-escape-injection-sanitization.md`
  - `../../../todos/003-pending-p2-unbounded-input-memory-usage.md`
- Validation artifacts:
  - `../../validation/2026-03-05-acceptance-pty.md`
  - `../../validation/2026-03-05-ink-spike.md`
- Planning context:
  - `../../plans/2026-03-04-feat-rsvp-speed-reading-mvp-plan.md`

No prior `docs/solutions/` issues existed at capture time.
