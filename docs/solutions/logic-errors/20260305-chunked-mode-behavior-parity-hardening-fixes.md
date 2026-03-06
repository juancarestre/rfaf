---
module: CLI Runtime
date: 2026-03-05
problem_type: logic_error
component: tooling
symptoms:
  - "Chunked mode startup UX was inconsistent and depended on label coupling instead of explicit mode state."
  - "Remaining time in chunked mode was inaccurate and less stable than RSVP mode."
  - "Chunk boundaries could leave punctuation (commas/sentence ends) in awkward positions that reduced readability."
  - "Agent API did not expose full chunked-mode parity with CLI summarize+chunked behavior."
  - "Summary argument normalization and terminal sanitization hardening were incomplete for strict safety contracts."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [chunked-mode, summary-compatibility, agent-parity, terminal-sanitization, timing]
---

# Troubleshooting: Chunked Mode Behavior, Parity, and Hardening Fixes

## Problem

After introducing chunked mode, several correctness and hardening gaps appeared in production-like usage: chunked startup semantics, chunked remaining-time behavior, punctuation-driven chunk readability, agent parity, and strict CLI/sanitization contracts.

## Environment

- Module: CLI Runtime
- Affected Component: mode pipeline, chunk transform, RSVP UI state/timing, agent reader API
- Date: 2026-03-05

## Symptoms

- Chunked mode startup wording/state did not consistently reflect chunked mode intent.
- Remaining time in chunked mode was less accurate than RSVP mode.
- Some chunks were hard to process due to punctuation placement inside chunks.
- CLI supported chunked mode + summary, but agent flows lacked equivalent behavior.
- Edge-case hardening review found summary arg ambiguity and carriage-return sanitization gap.

## What Didn't Work

**Attempted Solution 1:** Infer chunked behavior from decorated `sourceLabel` text.
- **Why it failed:** Mode became coupled to presentation strings, which is brittle and hard to maintain across surfaces.

**Attempted Solution 2:** Use render-time linear scans for chunked remaining-time estimation.
- **Why it failed:** This produced avoidable hot-path work and weaker timing consistency for large inputs/high WPM.

**Attempted Solution 3:** Keep summary arg normalization permissive and rely on partial output sanitization.
- **Why it failed:** Ambiguous behavior remained possible for `--summary` unknown values and CR line-spoofing hardening was incomplete.

## Solution

Implemented a focused P1/P2 hardening pass:

- Switched to explicit mode propagation (`mode` prop) across CLI -> App -> RSVP UI.
- Added chunk-aware remaining-time logic with suffix lookup for efficient and accurate updates.
- Improved punctuation-prioritized chunk splitting to increase readability.
- Extended agent API for chunked-mode parity and summarize+chunked behavior.
- Made `--summary` unknown-value handling fail closed.
- Expanded terminal sanitization to strip carriage-return control chars.

**Code changes (key references):**

```ts
// Explicit mode propagation
// src/cli/index.tsx
<App ... mode={mode} />

// src/ui/App.tsx
<RSVPScreen ... mode={mode} />
```

```ts
// Chunked remaining-time lookup (O(1) render access)
// src/ui/screens/RSVPScreen.tsx
const remainingSecondsLookup = useMemo(
  () => buildRemainingSecondsLookup(words, reader.currentWpm),
  [reader.currentWpm, words]
);
```

```ts
// Punctuation-prioritized splitting
// src/processor/chunker.ts
if (last.trailingPunctuation === "sentence_end" || last.trailingPunctuation === "clause_break") {
  return current.length >= 2;
}
```

```ts
// CR sanitization hardening
// src/ui/sanitize-terminal-text.ts
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\u007F-\u009F]/g;
```

**Validation/tests updated:**

- `tests/ui/rsvp-screen-remaining-time.test.ts`
- `tests/ui/chunked-screen-layout.test.tsx`
- `tests/processor/chunker.test.ts`
- `tests/agent/reader-api.test.ts`
- `tests/cli/summary-cli-contract.test.ts`
- `tests/ui/sanitize-terminal-text.test.ts`

**Commands run:**

```bash
bun test
bun x tsc --noEmit
```

Both passed.

## Why This Works

This fix set restores explicit state and boundary contracts:

1. **Mode contract** is now typed and explicit, not inferred from labels.
2. **Timing contract** in chunked mode is computed from chunk/source-word semantics with efficient lookup.
3. **Readability contract** is improved by punctuation-aware chunk boundaries.
4. **Parity contract** is restored by enabling chunked mode in agent flows.
5. **Safety contract** is strengthened with fail-closed summary parsing and CR sanitization.

## Prevention

- Keep mode state explicit across all layers; never infer control logic from display strings.
- Guard hot render paths with precomputed lookups for long-document scalability.
- Enforce punctuation boundary rules with deterministic chunker tests.
- For every CLI-visible capability, include agent parity decisions and tests in the same cycle.
- Maintain final-output sanitization with explicit tests for ANSI/OSC and carriage-return payloads.

## Related Issues

- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`
- `docs/validation/2026-03-05-acceptance-pty.md`
