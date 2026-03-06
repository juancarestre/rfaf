---
module: CLI Runtime
date: 2026-03-06
problem_type: logic_error
component: tooling
symptoms:
  - "Agent runtime accepted unvalidated readingMode payloads (fail-open boundary)"
  - "Repeated mode switches recomputed full transforms and caused avoidable latency on large corpora"
  - "Bionic transform mutated canonical token text, risking Unicode width/layout instability"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [bionic-mode, agent-parity, fail-closed, mode-caching, unicode-safety, terminal-rendering]
---

# Troubleshooting: Bionic Mode P2 Hardening (Validation, Caching, Unicode Safety)

## Problem

After shipping bionic mode, review findings identified three cross-layer hardening gaps: agent mode validation was not runtime fail-closed, mode switching did repeated O(n) recomputation, and bionic emphasis mutated canonical text in a way that could create Unicode/layout instability.

## Environment

- Module: CLI Runtime
- Affected Component: Agent reader runtime, processor transform layer, RSVP render path
- Date: 2026-03-06
- Commits: `54a4d7d`, `ec190ce`

## Symptoms

- Invalid or hostile `readingMode` values could reach agent command/summarize paths without strict runtime rejection.
- `set_reading_mode` rebuilt transformed arrays from `sourceWords` on each toggle.
- Bionic emphasis uppercased token text in processor stage, coupling data mutation with display concerns.

## What Didn't Work

**Attempted Solution 1:** Rely on TypeScript typing for `readingMode` safety in agent commands.
- **Why it failed:** Typed guarantees do not protect runtime payload boundaries from untyped JSON/tool callers.

**Attempted Solution 2:** Recompute transform output each time mode changes.
- **Why it failed:** Correct but inefficient; introduces avoidable linear work on repeated toggles.

**Attempted Solution 3:** Apply uppercase emphasis directly inside processor transform.
- **Why it failed:** Mutates canonical token text and can introduce Unicode expansion/width side effects.

## Solution

Implemented three coordinated fixes:

1. **Fail-closed runtime validation** for agent `readingMode` at command boundaries.
2. **Per-mode transform cache** (`modeWordCache`) in agent runtime with summarize-triggered cache reset.
3. **Render-time emphasis** for bionic display while preserving canonical token text in processor output.

**Code changes**:

```ts
// src/agent/reader-api.ts
function requireReadingMode(value: unknown, context: string): ReadingMode {
  if (typeof value !== "string") {
    throw new Error(`Invalid readingMode in ${context}. Use one of: ${READING_MODES.join(", ")}.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!READING_MODES.includes(normalized as ReadingMode)) {
    throw new Error(`Invalid readingMode in ${context}. Use one of: ${READING_MODES.join(", ")}.`);
  }
  return normalized as ReadingMode;
}

function getWordsForMode(
  sourceWords: Word[],
  readingMode: ReadingMode,
  modeWordCache: Partial<Record<ReadingMode, Word[]>>
) {
  const cached = modeWordCache[readingMode];
  if (cached) return { words: cached, modeWordCache };

  const transformedWords = transformWordsForMode(sourceWords, readingMode);
  return {
    words: transformedWords,
    modeWordCache: { ...modeWordCache, [readingMode]: transformedWords },
  };
}
```

```ts
// src/processor/bionic.ts + src/ui/components/WordDisplay.tsx
// Processor now keeps canonical text unchanged and stores metadata only.
return { ...word, bionicPrefixLength };

// UI applies emphasis at render/layout boundary.
const displayWord = emphasizePrefixAlphaNumeric(baseDisplayWord, bionicPrefixLength);
```

**Commands run**:

```bash
bun test tests/agent/reader-api.test.ts tests/processor/bionic.test.ts tests/ui/word-display.test.tsx tests/ui/bionic-screen-layout.test.tsx
bun test
bun x tsc --noEmit
```

## Why This Works

1. Runtime mode validation rejects malformed values before state transitions, summarization side effects, or metadata formatting.
2. Mode caching reuses previously transformed arrays and only recomputes when the source corpus changes.
3. Keeping canonical tokens immutable in processor layer separates data correctness from presentation styling, avoiding Unicode mutation side effects in core text state.

## Prevention

- Validate all agent-facing enum-like inputs at runtime, even when TypeScript types exist.
- Use lazy per-mode caches for mode-dependent O(n) transforms in interactive flows.
- Keep transforms canonical and apply visual styling at render boundaries.
- Maintain targeted tests for invalid payloads, cache reuse/invalidation, and Unicode edge cases.
- Preserve deterministic behavior contracts across CLI and agent surfaces in the same release.

## Related Issues

- See also: `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- See also: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- See also: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- See also: `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`
