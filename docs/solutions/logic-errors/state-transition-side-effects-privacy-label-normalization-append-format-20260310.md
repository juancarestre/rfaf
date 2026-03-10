---
module: Session History
date: 2026-03-10
problem_type: logic_error
component: tooling
symptoms:
  - "Completed-session persistence could be triggered from runtime update flow in a way that risked duplicate writes."
  - "Persisted source labels could expose full local paths or full URLs instead of privacy-safe labels."
  - "History append behavior depended on storage format and could degrade deterministic write/read behavior."
  - "CLI command routing for `history` could conflict with positional input semantics."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [session-history, determinism, privacy-normalization, cli-contracts, jsonl-storage]
---

# Troubleshooting: Session History Determinism, Privacy Labels, and Append Format Hardening

## Problem
The new session history feature worked functionally, but contract-level review found correctness and safety gaps across runtime transition handling, label persistence privacy, storage append behavior, and CLI routing determinism.

## Environment
- Module: Session History
- Affected Component: CLI/runtime tooling (`src/ui/App.tsx`, `src/history/*`, `src/cli/index.tsx`)
- Date: 2026-03-10

## Symptoms
- History writes happened during runtime update flow, which created replay/duplication risk if transition evaluation was repeated.
- Source labels in history could include full path/URL details not intended for persisted progress logs.
- Append behavior had to handle both legacy JSON-array and new append-friendly format safely.
- `rfaf history` command handling needed to avoid breaking positional input behavior for a literal file named `history`.

## What Didn't Work

**Attempted Solution 1:** Persist directly from the runtime state updater.
- **Why it failed:** State updaters should be pure; side effects there can replay and produce nondeterministic duplicate writes.

**Attempted Solution 2:** Treat terminal sanitization as sufficient privacy handling for source labels.
- **Why it failed:** Removing control sequences does not remove sensitive metadata like full paths, query strings, or fragments.

**Attempted Solution 3:** Keep generic append behavior without explicit format compatibility strategy.
- **Why it failed:** Existing files may be legacy JSON arrays; append-only writes need compatibility logic and deterministic migration behavior.

## Solution

Hardened the history subsystem in four linked steps:

1. Moved persistence side effects out of the state updater into a post-transition `useEffect` boundary.
2. Added privacy normalization for history labels (URL host/leaf, path basename) before persistence.
3. Switched write behavior to append-friendly JSONL with legacy JSON-array compatibility and atomic rewrite path.
4. Tightened CLI routing so only exact single-token `history` triggers the command fast path.

**Code changes**:
```ts
// src/ui/App.tsx
useEffect(() => {
  const previousRuntime = previousRuntimeRef.current;

  if (historyPath && previousRuntime) {
    persistCompletedSessionTransition({
      historyPath,
      currentReader: previousRuntime.reader,
      nextReader: runtime.reader,
      nextSession: runtime.session,
      mode: runtime.activeMode,
      sourceLabel,
    });
  }

  previousRuntimeRef.current = runtime;
}, [historyPath, runtime, sourceLabel]);
```

```ts
// src/history/session-record.ts
const normalizedBase = normalizeUrlLabel(base) ?? normalizePathLabel(base) ?? base;
const normalized = `${normalizedBase}${suffix}`.trim();
return truncateWithAsciiEllipsis(normalized, MAX_HISTORY_SOURCE_LABEL_LENGTH);
```

```ts
// src/history/history-store.ts
if (existsSync(historyPath)) {
  const existing = readFileSync(historyPath, "utf8").trimStart();
  if (existing.startsWith("[")) {
    const records = readHistoryRecords(historyPath);
    records.push(toPersistedRecord(record));
    writeHistoryRecords(historyPath, records);
    return;
  }
}

appendFileSync(historyPath, `${JSON.stringify(toPersistedRecord(record))}\n`, "utf8");
```

```ts
// src/cli/index.tsx
if (rawArgs.length === 1 && rawArgs[0] === "history") {
  process.stdout.write(renderHistoryCommand(defaultHistoryPath(process.env)));
  return;
}
```

**Commands run**:
```bash
bun test
bun x tsc --noEmit
```

## Why This Works

1. The runtime transition boundary is explicit: persistence now runs after state updates, not during state calculation, eliminating updater impurity risk.
2. Label handling separates terminal safety from privacy safety, ensuring persisted history labels are both readable and non-leaky by default.
3. Storage behavior is deterministic across old and new file formats, and append operations avoid repeated full rewrites.
4. CLI command dispatch is narrow and explicit, preserving subcommand usability without broadly shadowing positional-input semantics.

## Prevention

- Never perform filesystem writes inside state updater/reducer callbacks.
- Normalize persisted source labels for privacy, not only terminal rendering.
- Keep append path format-aware and backward-compatible when introducing new storage layouts.
- Add CLI contract tests for command-vs-input disambiguation.
- Keep deterministic contract tests for completion transitions and no-op transitions.

## Related Issues

- See also: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- See also: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- See also: `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- See also: `docs/solutions/integration-issues/markdown-ingestion-deterministic-contracts-timeout-size-guardrails-cli-agent-parity.md`
- See also: `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- See also: `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
