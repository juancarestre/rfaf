---
module: CLI Runtime
date: 2026-03-07
problem_type: logic_error
component: tooling
symptoms:
  - "Help overlay advertised `1-4 switch mode`, but mode hotkeys were ignored while help was open."
  - "Agent `set_reading_mode` rebuilt runtime and paused playback even when switching to the already-active mode."
  - "Agent scroll line stepping used a fixed width, so line-step commands could land on different words than the TUI at the same viewport width."
  - "Repeated runtime mode switches and repeated agent scroll line steps did unnecessary remap and line-map recomputation."
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [runtime-mode-switching, agent-parity, help-overlay, guided-scroll, position-mapping, caching]
---

# Troubleshooting: Runtime Mode Switching Hardening In CLI Runtime

## Problem

Runtime mode switching shipped successfully, but review exposed a second layer of correctness problems that only showed up once the TUI and agent API were treated as two surfaces of the same feature. The core feature worked, but several contracts drifted: help text documented hotkeys that did not actually work while help was open, the agent API handled same-mode switches differently from the TUI, scroll line stepping depended on an invisible fixed width, and the shared remap/render path still did avoidable O(n) work during repeated switching.

The final fix hardened runtime switching so `rsvp`, `chunked`, `bionic`, and `scroll` now behave consistently across App state, Ink screens, PTY behavior, and agent commands.

## Environment

- Module: CLI Runtime
- Runtime: Bun + Ink (TypeScript)
- Affected Component: runtime mode switching, guided scroll rendering, agent reader parity
- Date: 2026-03-07
- Commits: `80c0f60`, `1d13673`

## Symptoms

- Opening help showed `1-4        switch mode`, but pressing `1`-`4` did nothing until help was closed.
- Agent `set_reading_mode` paused and rebuilt state even when the requested mode already matched the active mode.
- Agent `step_next_line` and `step_prev_line` used a fixed content width, so the same text could step differently than the TUI on narrow or wide terminals.
- Switching between transformed and pass-through modes reused cached words, but remapping still linearly scanned target arrays each time.
- Guided scroll computed the full line map and materialized text for every line even though the UI only rendered the visible window.

## What Didn't Work

**Attempted Solution 1:** Ship the initial runtime switching feature with separate TUI and agent follow-up behavior.
- **Why it failed:** the feature existed on both surfaces, but key semantics were not fully shared. Review exposed mismatches in no-op switching, help behavior, and scroll stepping.

**Attempted Solution 2:** Use progress-ratio and fixed-width assumptions as a sufficient approximation for all mode and scroll transitions.
- **Why it failed:** ratio fallback is acceptable as a last resort, but exact source-word mapping and viewport-aware wrapping are required for reliable parity between transformed modes and visible scroll lines.

**Attempted Solution 3:** Precompute all guided-scroll line text on each render/update.
- **Why it failed:** correct but unnecessarily expensive. Only a small visible window is rendered, so eagerly materializing every line adds avoidable work on switches and resizes.

## Solution

The solved version applied five coordinated fixes:

1. **Help contract fix**: numeric mode keys now bypass the help-visible guard, so overlay text matches actual behavior.
2. **Agent parity fix**: same-mode `set_reading_mode` is now a true no-op, matching the App runtime.
3. **Viewport-aware scroll stepping**: agent line-step commands accept `contentWidth` and cache line maps by `words + width`.
4. **Cached exact remapping**: shared position mapping caches source-index-to-target-index lookups per transformed word array.
5. **Visible-window rendering**: guided scroll now builds line text only for visible lines instead of materializing the whole document.

**Code changes**:

```ts
// src/ui/runtime-mode-state.ts
export function applyAppModeInput(runtime, sourceWords, input, nowMs = Date.now()) {
  const nextMode = getReadingModeForInput(input);
  if (nextMode !== null) {
    return switchAppReadingMode(runtime, sourceWords, nextMode, nowMs);
  }

  if (runtime.helpVisible) {
    return runtime;
  }

  return runtime;
}
```

```ts
// src/agent/reader-api.ts
case "set_reading_mode": {
  const readingMode = requireReadingMode(command.readingMode, "set_reading_mode command");
  if (readingMode === runtime.readingMode) {
    return runtime;
  }

  const { words: transformedWords, modeWordCache } = getWordsForMode(
    runtime.sourceWords,
    readingMode,
    runtime.modeWordCache
  );
  const targetIndex = mapPositionToNewWords(
    runtime.reader.currentIndex,
    runtime.reader.words,
    transformedWords
  );

  return {
    ...runtime,
    reader: {
      ...createReader(transformedWords, runtime.reader.currentWpm),
      currentIndex: targetIndex,
      state: runtime.reader.state === "finished" ? "finished" : "paused",
    },
    readingMode,
    modeWordCache,
    lineMapCache: null,
  };
}
```

```ts
// src/engine/position-mapping.ts
const targetIndexLookupCache = new WeakMap<Word[], number[]>();

function getTargetIndexLookup(targetWords: Word[]): number[] {
  const cached = targetIndexLookupCache.get(targetWords);
  if (cached) return cached;

  const lookup = new Array<number>(highestSourceIndex + 1).fill(-1);
  // Fill lookup[sourceIndex] = targetIndex once per transformed array.
  targetIndexLookupCache.set(targetWords, lookup);
  return lookup;
}
```

```ts
// src/agent/reader-api.ts
function getCachedLineMap(runtime: AgentReaderRuntime, contentWidth: number) {
  if (
    runtime.lineMapCache &&
    runtime.lineMapCache.words === runtime.reader.words &&
    runtime.lineMapCache.contentWidth === contentWidth
  ) {
    return { lineMap: runtime.lineMapCache.lineMap, lineMapCache: runtime.lineMapCache };
  }

  const lineMap = computeLineMap(runtime.reader.words, contentWidth);
  return { lineMap, lineMapCache: { words: runtime.reader.words, contentWidth, lineMap } };
}
```

```ts
// src/ui/screens/GuidedScrollScreen.tsx
const lineElements = useMemo(() => {
  const nextLineElements: { text: string; isCurrentLine: boolean }[] = [];

  for (let line = visibleStart; line <= visibleEnd; line++) {
    nextLineElements.push({
      text: buildLineText(
        sanitizedWords,
        getFirstWordIndexForLine(lineMap, line),
        getLastWordIndexForLine(lineMap, line)
      ),
      isCurrentLine: line === currentLine,
    });
  }

  return nextLineElements;
}, [currentLine, lineMap, sanitizedWords, visibleEnd, visibleStart]);
```

**Verification commands**:

```bash
bun test tests/ui/mode-switching-integration.test.ts tests/agent/reader-api.test.ts tests/agent/reader-api-scroll-parity.test.ts tests/cli/runtime-mode-switching-pty-contract.test.ts
bun test
bun x tsc --noEmit
```

All passed after the fix set.

## Why This Works

The real root cause was not a single bug. It was a shared-runtime contract problem:

1. **Behavioral contract drift**: the TUI and agent runtime were both implementing mode switching, but not all rules were encoded in one place. Same-mode switching, help-visible behavior, and scroll stepping semantics diverged.
2. **Viewport-dependent logic hidden as constants**: line stepping in scroll mode is not just about words; it is about wrapped visible lines. Wrapped lines depend on content width after padding, so fixed-width stepping cannot guarantee parity.
3. **Correctness and performance were linked**: once transformed arrays carry `sourceWords`, exact remapping is possible. But without caching, exact remapping and repeated line stepping stay unnecessarily expensive.
4. **Rendering contract mismatch**: guided scroll only displays a window of lines, so materializing every line each time wastes work on the interactive path.

The fix works because it turns those implicit assumptions into explicit shared contracts:

- mode keys always resolve through one runtime mode map
- same-mode switching is an early-return no-op on both surfaces
- scroll stepping can use the real viewport width
- remap and line-map costs are cached by stable identities
- guided scroll renders only what the user can actually see

## Prevention

- Keep one explicit contract per behavior and reuse it across help text, key handling, agent commands, status labels, and validation docs.
- Treat the TUI and agent API as two surfaces over one runtime model; avoid re-implementing mode semantics separately.
- Make viewport assumptions explicit inputs, not hidden constants.
- Cache hot-path O(n) transforms, remaps, and line maps by stable keys such as transformed word arrays and content width.
- Preserve canonical source text in core state and apply presentation-specific behavior at render boundaries.
- Require PTY coverage for terminal-visible contracts like keybindings, screen swaps, wrapped-line stepping, and help overlays.
- Add parity tests whenever a CLI-visible capability is also exposed through the agent runtime.

## Related Issues

- See also: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- See also: `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- See also: `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
- See also: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- See also: `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`
- Planning context: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-14-runtime-mode-switching-brainstorm.md`
- Implementation plan: `docs/plans/2026-03-06-feat-phase-3-subphase-14-runtime-mode-switching-plan.md`
- Validation artifact: `docs/validation/2026-03-06-runtime-mode-switching-acceptance-pty.md`
- Review follow-ups resolved here: `todos/044-complete-p2-help-overlay-mode-switch-contract.md`, `todos/045-complete-p2-agent-same-mode-switch-noop-parity.md`, `todos/046-complete-p2-agent-scroll-line-step-width-parity.md`, `todos/047-complete-p2-guided-scroll-render-precomputation-cost.md`, `todos/048-complete-p2-position-mapping-remap-scaling.md`, `todos/049-complete-p2-agent-line-map-caching.md`
- Remaining follow-up coverage gap: `todos/053-pending-p3-active-playback-mode-switch-pty-coverage.md`
