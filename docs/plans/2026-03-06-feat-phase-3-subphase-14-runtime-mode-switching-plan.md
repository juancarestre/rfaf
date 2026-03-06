---
title: "feat: Add Phase 3 Sub-phase 14 Runtime Mode Switching"
type: feat
status: active
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-14-runtime-mode-switching-brainstorm.md
---

# feat: Add Phase 3 Sub-phase 14 Runtime Mode Switching

## Overview

This plan adds runtime reading-mode switching inside the TUI using `1-4` keys (`1=rsvp`, `2=chunked`, `3=bionic`, `4=scroll`). Switching preserves the reader's approximate position via progress-ratio mapping, pauses playback so the reader can reorient, and caches per-mode word transforms to avoid recomputation on repeated toggles. The implementation follows a TDD-first approach throughout.

Origin brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-14-runtime-mode-switching-brainstorm.md`.

## Problem Statement / Motivation

Readers currently choose their reading mode at startup via `--mode`. Once a session begins, the only way to change modes is to quit and restart with a different `--mode` flag. This is disruptive: readers lose their place, their WPM setting, and their reading session. Runtime switching lets readers experiment with modes mid-session (e.g., start in RSVP for speed, switch to scroll for a dense paragraph) without losing context. This was identified as Phase 3 item 14 in the MVP scope brainstorm (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Research Summary

### Local Research

- **Agent API is the blueprint.** `AgentReaderRuntime` (`src/agent/reader-api.ts:55-63`) already implements the exact architecture: `sourceWords`, `modeWordCache`, `readingMode`, and a `set_reading_mode` command (`src/agent/reader-api.ts:345-379`) with progress-ratio position mapping and pause-on-switch.
- **App.tsx is a pure router.** Currently 37 lines, receives pre-transformed words, no state ownership (`src/ui/App.tsx:15-37`). Must become stateful.
- **Two screens serve four modes.** `RSVPScreen` handles rsvp/chunked/bionic; `GuidedScrollScreen` handles scroll. Switching between rsvp/chunked/bionic does NOT require screen swap — only switching to/from scroll does.
- **Significant code duplication.** `applyReaderAndSession` is duplicated verbatim between `RSVPScreen` (`src/ui/screens/RSVPScreen.tsx:102-137`) and `GuidedScrollScreen` (`src/ui/screens/GuidedScrollScreen.tsx:66-101`). `getLiveReadingTimeMs` and `buildRemainingSecondsLookup` are also duplicated.
- **Transform duplication flagged.** Todo `035-pending-p3-shared-reading-mode-transform-contract.md` identifies mode transform duplication between CLI pipeline (`src/cli/reading-pipeline.ts:64`) and agent API (`src/agent/reader-api.ts:104`). Extracting a shared module is a natural prerequisite.
- **No key conflicts.** Keys `1-4` are unused in both screens. No binding conflicts.
- **HelpOverlay is static.** Does not mention modes or differentiate step behavior by mode (`src/ui/components/HelpOverlay.tsx`).
- **StatusBar shows no mode indicator.** Only shows WPM, time, progress, state label, and source label (`src/ui/components/StatusBar.tsx`).

### Institutional Learnings Applied

- **Explicit mode propagation** — never infer mode from display strings; pass as typed prop (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).
- **Per-mode transform cache** — use lazy caches (`modeWordCache`) to avoid recomputing O(n) transforms on repeated toggles (`docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`).
- **Render-time emphasis** — apply visual styling at render boundaries, not in processor layer (`docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`).
- **Terminal lifecycle centralized** in `src/cli/session-lifecycle.ts` (`docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`).
- **Precomputed lookups for hot render paths** — remaining-time via lookup table, not linear scan (`docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`).
- **Agent parity** — every CLI-visible capability must have equivalent agent API support in the same release cycle (`docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`).
- **Line-map measurement-rendering parity** — measure sanitized text for line wrapping (`docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`).

### External Research Decision

Skipped. Strong local context — the agent API serves as a complete reference implementation, institutional learnings cover all relevant patterns, and there are no external integrations.

## Proposed Solution

### Chosen Approach and Rejected Alternatives

- **Chosen:** App-level runtime mode state. `App` owns canonical source words, active mode, per-mode transformed caches, Reader, and Session. Screens become presentational, receiving state + callbacks. (see brainstorm: `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-14-runtime-mode-switching-brainstorm.md`)
- **Rejected:**
  - Screen-local switching callbacks — runtime switching crosses screen boundaries (rsvp ↔ scroll requires unmount/mount), so keeping mode state in screens would create drift and require complex extraction-before-unmount logic.
  - Shared runtime controller abstraction — overbuilt for this phase. If a controller becomes necessary later, the App-owns-state pattern is a natural stepping stone.

### Architectural Refactoring: Lift State to App

The core refactoring is lifting Reader and Session state from individual screens up to `App`. This mirrors the `AgentReaderRuntime` pattern and is the prerequisite for runtime switching.

**Before (current):**
```
CLI → buildReadingPipeline(mode) → pre-transformed words
  → App(words, mode)  [stateless router]
    → RSVPScreen(words) [owns Reader, Session, timer, input]
    → GuidedScrollScreen(words) [owns Reader, Session, timer, input]
```

**After:**
```
CLI → buildReadingPipeline("rsvp") → sourceWords (always tokenized, no mode transform)
  → App(sourceWords, initialMode)  [owns Reader, Session, activeMode, modeWordCache]
    → RSVPScreen(reader, session, words, mode, callbacks)  [presentational]
    → GuidedScrollScreen(reader, session, words, mode, callbacks)  [presentational]
```

### Shared Module Extraction (resolves todo #035)

Extract mode transform logic into a shared module used by both CLI pipeline and agent API:

**New file: `src/processor/mode-transform.ts`**

```typescript
// src/processor/mode-transform.ts
import type { ReadingMode } from "../cli/mode-option";
import type { Word } from "./types";
import { chunkWords } from "./chunker";
import { applyBionicMode } from "./bionic";

export type ModeWordCache = Partial<Record<ReadingMode, Word[]>>;

export function transformWordsForMode(words: Word[], readingMode: ReadingMode): Word[] {
  switch (readingMode) {
    case "chunked":
      return chunkWords(words);
    case "bionic":
      return applyBionicMode(words);
    case "rsvp":
    case "scroll":
      return words;
  }
}

export function getWordsForMode(
  sourceWords: Word[],
  readingMode: ReadingMode,
  modeWordCache: ModeWordCache
): { words: Word[]; modeWordCache: ModeWordCache } {
  const cached = modeWordCache[readingMode];
  if (cached) {
    return { words: cached, modeWordCache };
  }

  const transformedWords = transformWordsForMode(sourceWords, readingMode);
  return {
    words: transformedWords,
    modeWordCache: { ...modeWordCache, [readingMode]: transformedWords },
  };
}
```

**New file: `src/engine/reader-session-sync.ts`**

Extract the duplicated `applyReaderAndSession` function:

```typescript
// src/engine/reader-session-sync.ts
import type { Reader } from "./reader";
import type { Session } from "./session";
import { markPaused, markPlayStarted, markWordAdvanced, finishSession } from "./session";

export function applyReaderAndSession(
  currentReader: Reader,
  currentSession: Session,
  nextReader: Reader,
  nowMs: number = Date.now()
): Session {
  let nextSession = currentSession;

  if (currentReader.state !== "playing" && nextReader.state === "playing") {
    nextSession = markPlayStarted(nextSession, now);
  }

  if (currentReader.state === "playing" && nextReader.state !== "playing") {
    nextSession = markPaused(nextSession, now);
  }

  if (
    currentReader.state === "playing" &&
    nextReader.currentIndex > currentReader.currentIndex
  ) {
    const steps = nextReader.currentIndex - currentReader.currentIndex;
    for (let i = 0; i < steps; i++) {
      nextSession = markWordAdvanced(nextSession);
    }
  }

  if (nextSession.currentWpm !== nextReader.currentWpm) {
    nextSession = { ...nextSession, currentWpm: nextReader.currentWpm };
  }

  if (currentReader.state !== "finished" && nextReader.state === "finished") {
    nextSession = finishSession(nextSession, now);
  }

  return nextSession;
}
```

### Position Mapping

Use progress-ratio mapping, consistent with the agent API (`src/agent/reader-api.ts:357-367`):

```typescript
// src/engine/position-mapping.ts
export function mapPositionToNewWords(
  currentIndex: number,
  currentWordsLength: number,
  targetWordsLength: number
): number {
  if (currentWordsLength <= 1 || targetWordsLength <= 1) {
    return 0;
  }

  const progressRatio = currentIndex / (currentWordsLength - 1);
  return Math.min(
    targetWordsLength - 1,
    Math.round(progressRatio * (targetWordsLength - 1))
  );
}
```

**Position drift is acceptable.** Round-trip switching (e.g., RSVP pos 50/99 → Chunked pos 15/29 → RSVP pos 51/99) may drift by ±1 word. This matches the agent API behavior and is negligible in practice. If drift becomes noticeable, a future optimization can use `sourceWords` metadata on chunked words for exact alignment.

### Mode Switching Behavior Contract

1. **Keys:** `1=rsvp`, `2=chunked`, `3=bionic`, `4=scroll`.
2. **Same-mode re-selection:** No-op. If `requestedMode === activeMode`, return immediately with no state change (see brainstorm: key decision about preserving reading place).
3. **Position preservation:** Map position via progress ratio (see brainstorm: "keep the user at the equivalent reading location").
4. **Pause on switch:** Force reader state to `"paused"` after switching, unless already `"finished"` (see brainstorm: "playback pauses so the user can reorient before resuming").
5. **Finished state:** If reader is `"finished"`, map to last index of new array and preserve `"finished"` state.
6. **WPM preservation:** Current WPM carries over to the new mode.
7. **Session continuity:** Session persists across mode switches (total reading time, words read). This differs from the agent API (which resets session), but makes sense for the TUI where the user is reading the same document continuously.
8. **Cache reuse:** Repeated switches to a previously visited mode use cached word arrays without recomputation.

### Key Handling Architecture

`App` handles `1-4` keys exclusively. Screens handle all other keys.

**Why App-level handling:** Ink's `useInput` fires for all components in the tree. If both App and screens have `useInput`, both fire on every keypress. To avoid dual-handler complexity:
- App registers `useInput` for `1-4` keys (and `q` for quit).
- Screens register `useInput` for all other keys (space, h/l, j/k, p/b, r, ?).
- Screens receive `reader`, `session`, `updateReader`, and `onQuit` as props from App.

**Help overlay interaction:** When help overlay is visible, screens suppress all keys except `?`/Esc/`q`. Mode switch keys (`1-4`) will also be suppressed by App when a `helpVisible` prop is true. This is consistent with the current pattern where help overlay blocks all input. The user must close help first, then press `1-4`.

### Screen Transition Strategy

**Same-screen switches (rsvp ↔ chunked ↔ bionic):**
- RSVPScreen receives new `words`, `mode`, and updated `reader` props.
- No unmount/mount — React re-renders with new props.
- No timer leaks, no visual flicker.

**Cross-screen switches (any ↔ scroll):**
- RSVPScreen unmounts, GuidedScrollScreen mounts (or vice versa).
- React destroys the old screen's state, effects, and timers (cleanup runs via effect returns).
- Since Reader/Session state lives in App, no state is lost.
- GuidedScrollScreen mounts with the correct `reader` position and `"paused"` state.

**Potential flash mitigation:** Ink 6's reconciler should handle conditional rendering without a blank frame, since both branches render a `<Box>` with identical outer structure. If visual glitch is observed in PTY testing, consider using a `key` prop on screens to control React reconciliation.

### Visual Feedback

**StatusBar mode indicator:**
- Add `activeMode` prop to StatusBar.
- Display mode name in the status line: `300 WPM | 2:30 remaining | 45% | [RSVP] Paused | file.txt`
- Use brackets around mode name for visual distinction.

**HelpOverlay updates:**
- Add `1-4` mode switching keys to the help overlay.
- Differentiate step behavior: "l / Right  step forward (word)" for RSVP modes vs "l / Right  step forward (line)" for scroll.
- Accept `mode` prop to display context-appropriate help text.

**State label updates:**
- Initial idle message includes mode name for all modes: "Press Space to start (RSVP)", "Press Space to start (Scroll)", etc.
- After switching, state label shows "Paused" (no transient "Switched to X" notification — the StatusBar mode indicator provides persistent confirmation).

### CLI Pipeline Change

The CLI pipeline currently transforms words for the startup mode before passing to App. With runtime switching, App needs the canonical (untransformed) source words plus the initial mode:

```typescript
// In src/cli/index.tsx — pipeline now always returns tokenized words
const { words: sourceWords, sourceLabel: finalLabel } = await buildReadingPipeline({
  documentContent: document.content,
  sourceLabel: document.source,
  summaryOption,
  mode: "rsvp", // Always tokenize without mode transform
});

// App receives source words and initial mode
render(<App sourceWords={sourceWords} initialMode={mode} initialWpm={wpm} ... />);
```

Alternatively, keep the pipeline unchanged and pass `sourceWords` separately. The key constraint: App must have access to the raw tokenized words (pre-mode-transform) to derive other mode transforms at runtime.

**Simpler approach:** Pass `mode` to App and have App compute the initial transform itself using `getWordsForMode`. This keeps the pipeline simpler and avoids the "which words did I receive?" ambiguity:

```typescript
// Pipeline returns tokenized-only words (mode transform removed from pipeline)
// App receives sourceWords and computes mode-specific words internally
```

## Technical Considerations

- **React state batching:** Rapid mode switches (user presses 1→2→3→4 quickly) will be batched by React. Each switch computes position from the current state. Since `useState` updaters see the latest state, intermediate states are consistent. Final render shows the last-selected mode.
- **Timer cleanup on switch:** When mode changes cause playback state to change (playing → paused), the effect dependency on `reader.state` triggers cleanup of the `setTimeout` timer. No timer leaks.
- **Line map recomputation:** When switching to scroll mode, `GuidedScrollScreen` mounts and computes `lineMap` in a `useMemo` on first render. No stale line map risk.
- **Memory:** Per-mode word caches hold at most 4 word arrays (one per mode). For a 10,000-word document, chunked produces ~2,500 entries, bionic produces 10,000 entries (same count, added metadata). Total cache size is bounded and small.
- **Performance:** Mode transforms are O(n) in word count. For typical documents (1,000-10,000 words), this is sub-millisecond. Cached on first access; subsequent switches are O(1) lookup.

## System-Wide Impact

### Interaction Graph

CLI parse → mode resolution → tokenize → App mount → `getWordsForMode(sourceWords, initialMode)` → Reader creation → Screen render → User presses `1-4` → App `handleModeSwitch` → `getWordsForMode(sourceWords, newMode)` → `mapPositionToNewWords` → Reader state update (pause + position) → Screen re-render (or swap for scroll ↔ non-scroll).

### Error & Failure Propagation

- Invalid mode key (5, 6, etc.): silently ignored at App `useInput` handler level.
- Transform failure (theoretically impossible for valid words, but defensive): catch in `getWordsForMode`, log warning, remain on current mode.
- Component crash during screen swap: React error boundary (if implemented) or Ink's default error handling. Terminal lifecycle cleanup in `session-lifecycle.ts` guarantees restoration.

### State Lifecycle Risks

- **Partial state update during switch:** Mode switch updates `activeMode`, `reader`, and `modeWordCache` atomically via a single `setState` call in App. No intermediate inconsistent state visible to React.
- **Session continuity:** Session is NOT reset on switch (differs from agent API). Total reading time and words-read count persist. This avoids losing progress statistics during exploratory mode switching.
- **Cache invalidation:** Cache is never invalidated during a session (source words don't change). Summary changes create a new App mount with new source words.

### API Surface Parity

- Agent API already supports runtime mode switching (`set_reading_mode` command, `src/agent/reader-api.ts:345-379`).
- TUI implementation mirrors agent API behavior with one documented divergence: session persistence vs. session reset.
- No new agent API changes needed. Parity is already achieved.

### Integration Test Scenarios

1. RSVP at position 50/100 → press `2` → chunked at position ~15/30, paused.
2. Chunked → press `4` → scroll mode renders, GuidedScrollScreen mounts, RSVPScreen unmounts, reader paused at mapped position.
3. Scroll → press `1` → RSVP mode renders, same reader position ratio, paused.
4. Rapid sequence: press `1→2→3→4` within 100ms → final state is scroll at correct position.
5. Switch at finished state → remains finished in new mode at last word.

## Acceptance Criteria

### Functional Requirements

- [ ] Pressing `1` switches to RSVP mode.
- [ ] Pressing `2` switches to chunked mode.
- [ ] Pressing `3` switches to bionic mode.
- [ ] Pressing `4` switches to scroll mode.
- [ ] Same-mode re-selection (e.g., pressing `1` while in RSVP) is a no-op — no pause, no position change, no state mutation.
- [ ] Reading position is preserved via progress-ratio mapping (within ±1 word tolerance on round-trip).
- [ ] Playback pauses on every mode switch (reader state becomes `"paused"`).
- [ ] WPM setting is preserved across mode switches.
- [ ] Per-mode word caches avoid recomputation on repeated switches.
- [ ] Cache returns identical reference on repeated access (referential equality).

### Screen Transition Requirements

- [ ] Switching between rsvp/chunked/bionic renders RSVPScreen with updated words and mode — no unmount/mount.
- [ ] Switching to/from scroll correctly mounts/unmounts the appropriate screen.
- [ ] No timer leaks or resize listener leaks on screen swap.
- [ ] No visual flicker or blank frame during screen swap.

### Edge Case Requirements

- [ ] Single-word document: mode switch works without crash (no division by zero).
- [ ] Switch at index 0 (beginning): stays at index 0 in all modes.
- [ ] Switch at last index: maps to last index of new array, preserves `"finished"` state.
- [ ] Rapid switching (4 switches in <100ms): final state is consistent.
- [ ] Empty document guard: `createReader` already throws on empty words — mode switch never produces empty arrays since source is non-empty.

### Visual Feedback Requirements

- [ ] Active mode is visible in StatusBar at all times (e.g., `[RSVP]` prefix in status line).
- [ ] Help overlay includes `1-4` key bindings for mode switching.
- [ ] Help overlay differentiates step behavior by mode (word-step vs line-step).
- [ ] Initial idle message shows mode name: "Press Space to start (RSVP)", "Press Space to start (Scroll)", etc.

### Session & State Requirements

- [ ] Total reading time persists across mode switches (session not reset).
- [ ] All existing key bindings continue to work after mode switch (space, h/l, j/k, p/b, r, ?, q).
- [ ] Paragraph jump works correctly with mode-specific word arrays.
- [ ] Speed adjustment works correctly after mode switch.
- [ ] Restart (`r`) works correctly after mode switch (restarts in current mode, not initial mode).
- [ ] Help overlay (`?`) works correctly after mode switch.

### Quality Gates (TDD-First Mandatory)

- [ ] Each contract slice follows red → green → refactor before advancing.
- [ ] Tests for contracts are authored before implementation.
- [ ] `bun test` passes with zero failures.
- [ ] `bun x tsc --noEmit` passes.
- [ ] PTY validation includes mode switching, position preservation, and screen swap checks.

## Testing Strategy (TDD First)

### TDD Sequence

The implementation follows strict red → green → refactor for each slice. Tests are written BEFORE the code they test.

### Phase A Tests (Shared Module Extraction)

**`tests/processor/mode-transform.test.ts`**
- `transformWordsForMode` returns chunked words for "chunked".
- `transformWordsForMode` returns bionic words for "bionic".
- `transformWordsForMode` returns pass-through for "rsvp" and "scroll".
- Exhaustive switch — compile-time failure if a new mode is added without a branch.
- `getWordsForMode` caches results (referential equality on second call).
- `getWordsForMode` creates and caches on first call (cache miss).
- `getWordsForMode` does not mutate the input cache object.

**`tests/engine/reader-session-sync.test.ts`**
- `applyReaderAndSession` marks session as playing when reader transitions idle/paused → playing.
- `applyReaderAndSession` marks session as paused when reader transitions playing → paused.
- `applyReaderAndSession` advances word count when reader index increases while playing.
- `applyReaderAndSession` updates session WPM when reader WPM changes.
- `applyReaderAndSession` finishes session when reader transitions to finished.
- Behavioral parity with existing inline implementations in RSVPScreen and GuidedScrollScreen.

**`tests/engine/position-mapping.test.ts`**
- Maps position proportionally: index 50 of 100 words → index 15 of 30 words.
- Single-word source: returns 0 (no division by zero).
- Single-word target: returns 0.
- Index 0: maps to 0 in any target length.
- Last index: maps to last index of target.
- Round-trip drift: RSVP 50/99 → Chunked 15/29 → RSVP 51/99 (±1 tolerance).
- Empty arrays: handled (returns 0).

### Phase B Tests (App State Lifting)

**`tests/ui/app-state-management.test.tsx`**
- App initializes Reader from source words + initial mode + initial WPM.
- App initializes Session with initial WPM.
- App computes initial mode-specific words via `getWordsForMode`.
- App renders RSVPScreen for modes rsvp, chunked, bionic.
- App renders GuidedScrollScreen for mode scroll.
- App passes reader, session, words, mode, and callbacks to screens.
- Screen components receive all required props (type-check coverage).

### Phase C Tests (Mode Switching Logic)

**`tests/ui/app-mode-switching.test.tsx`**
- Pressing `1` while in chunked switches to RSVP, pauses, preserves position.
- Pressing `2` while in RSVP switches to chunked, pauses, preserves position.
- Pressing `3` while in RSVP switches to bionic, pauses, preserves position.
- Pressing `4` while in RSVP switches to scroll, pauses, preserves position, renders GuidedScrollScreen.
- Pressing `4` then `1` round-trips: scroll → RSVP, correct position.
- Same-mode press (e.g., `1` while in RSVP) is a no-op.
- Mode switch preserves WPM.
- Mode switch preserves session (total reading time, words read).
- Mode switch at finished state preserves finished state.
- Mode switch at index 0 stays at index 0.
- Mode switch with single-word document doesn't crash.
- Cache hit on repeated switch (no recomputation).
- Keys 5-9 are silently ignored.

### Phase D Tests (Visual Feedback)

**`tests/ui/status-bar-mode-indicator.test.tsx`**
- StatusBar renders mode indicator when `activeMode` prop is provided.
- StatusBar shows `[RSVP]`, `[Chunked]`, `[Bionic]`, `[Scroll]` for each mode.

**`tests/ui/help-overlay-mode-keys.test.tsx`**
- HelpOverlay shows `1-4` key bindings for mode switching.
- HelpOverlay shows "step forward (word)" for non-scroll modes.
- HelpOverlay shows "step forward (line)" for scroll mode.

**`tests/ui/state-label-mode-name.test.tsx`**
- Initial idle message includes mode name for all four modes.
- State label after mode switch shows "Paused" (not "Switched to X").

### Phase E Tests (Integration / PTY)

**`tests/ui/mode-switching-integration.test.tsx`**
- Full mode-switch cycle: start RSVP → play → advance 10 words → switch to chunked → verify position → switch to scroll → verify GuidedScrollScreen renders → switch to bionic → verify RSVPScreen renders with bionic styling.
- Rapid switching: 1→2→3→4 in sequence → final state is scroll.
- Mode switch while playing: timer is canceled, state is paused.
- Mode switch interaction with help overlay: 1-4 keys blocked while help is visible.

**`docs/validation/2026-03-06-runtime-mode-switching-acceptance-pty.md`**
- PTY command transcripts for: mode switch during reading, position preservation visual verification, screen swap (RSVP ↔ Scroll), mode indicator in status bar, help overlay with mode keys, rapid switching, edge cases.

## Suggested Implementation Phases

### Phase A: Shared Module Extraction + Red Tests

**Goal:** Extract shared utilities and write failing tests for them.

**Tasks:**
1. Write failing tests for `transformWordsForMode` and `getWordsForMode` in `tests/processor/mode-transform.test.ts`.
2. Write failing tests for `applyReaderAndSession` in `tests/engine/reader-session-sync.test.ts`.
3. Write failing tests for `mapPositionToNewWords` in `tests/engine/position-mapping.test.ts`.
4. Create `src/processor/mode-transform.ts` with `transformWordsForMode`, `getWordsForMode`, and `ModeWordCache` type.
5. Create `src/engine/reader-session-sync.ts` with extracted `applyReaderAndSession`.
6. Create `src/engine/position-mapping.ts` with `mapPositionToNewWords`.
7. Update `src/agent/reader-api.ts` to import from shared modules (remove inline implementations).
8. Update `src/cli/reading-pipeline.ts` to import from `src/processor/mode-transform.ts`.
9. Update `src/ui/screens/RSVPScreen.tsx` to import `applyReaderAndSession` from shared module.
10. Update `src/ui/screens/GuidedScrollScreen.tsx` to import `applyReaderAndSession` from shared module.
11. Verify all existing tests pass. `bun test` + `bun x tsc --noEmit`.
12. Close todo `035-pending-p3-shared-reading-mode-transform-contract.md`.

**Success criteria:** All new and existing tests green. No behavioral change. Shared modules are the single source of truth.

### Phase B: Lift State to App + Red Tests

**Goal:** Move Reader, Session, and mode state from screens to App. Screens become presentational.

**Tasks:**
1. Write failing tests for App state management in `tests/ui/app-state-management.test.tsx`.
2. Define new `AppProps` interface: `{ sourceWords, initialMode, initialWpm, sourceLabel, textScale }`.
3. Add state to App: `activeMode`, `reader`, `session`, `modeWordCache`, `currentWords` (derived from cache).
4. Add `updateReader` callback in App (mirrors the pattern currently in screens).
5. Define new screen props interfaces: `{ reader, session, words, mode, textScale, sourceLabel, updateReader, onRestart, onToggleHelp, helpVisible, terminalSize }`.
6. Refactor `RSVPScreen` to receive state as props instead of managing it internally. Remove `useState` calls for reader, session. Keep local UI state (terminal size detection handled by App or screen — keep in screen for simplicity, but reader/session/mode from App).
7. Refactor `GuidedScrollScreen` similarly.
8. Update `src/cli/index.tsx` to pass `sourceWords` (tokenized, pre-mode-transform) to App instead of pre-transformed words.
9. Move timer effect (playback `setTimeout`) to App level so it operates on App-owned Reader state.
10. Verify all existing tests pass after refactoring. `bun test` + `bun x tsc --noEmit`.

**Critical detail:** Terminal size detection and help overlay can remain screen-local since they're rendering concerns. Reader, Session, activeMode, modeWordCache, and sourceWords must live in App.

**Alternative (simpler):** Keep timer effects in screens but have them call `updateReader` prop from App. This avoids moving the entire timer effect chain but requires screens to report state changes back.

**Success criteria:** App owns Reader + Session + mode state. Screens are presentational. All existing tests pass with no behavioral change.

### Phase C: Mode Switching Logic + Red Tests

**Goal:** Add 1-4 key handling to App for runtime mode switching.

**Tasks:**
1. Write failing tests for mode switching in `tests/ui/app-mode-switching.test.tsx`.
2. Add `useInput` handler in App for keys `1-4`:
   - Compute the target `ReadingMode` from key (`1→rsvp`, `2→chunked`, `3→bionic`, `4→scroll`).
   - If `targetMode === activeMode`, return (no-op).
   - Call `getWordsForMode(sourceWords, targetMode, modeWordCache)`.
   - Call `mapPositionToNewWords(reader.currentIndex, currentWords.length, newWords.length)`.
   - Update state: `activeMode`, `reader` (paused at new index with new words), `modeWordCache`.
   - Session persists (no reset).
3. Ensure `q` key handling works from App level (may need to move `exit()` call).
4. Ensure help-visible state blocks mode switch keys (pass `helpVisible` from screen to App, or lift help state to App).
5. Run all tests. `bun test` + `bun x tsc --noEmit`.

**Success criteria:** Mode switching works for all 12 non-trivial transitions (4 modes × 3 other modes). Position preserved. Playback paused. Session persists. Cache reused.

### Phase D: Visual Feedback + Red Tests

**Goal:** Add mode indicator to StatusBar, update HelpOverlay, update state labels.

**Tasks:**
1. Write failing tests for StatusBar mode indicator in `tests/ui/status-bar-mode-indicator.test.tsx`.
2. Write failing tests for HelpOverlay mode keys in `tests/ui/help-overlay-mode-keys.test.tsx`.
3. Write failing tests for state label mode names in `tests/ui/state-label-mode-name.test.tsx`.
4. Add `activeMode?: ReadingMode` prop to StatusBar. Render `[RSVP]`, `[Chunked]`, `[Bionic]`, `[Scroll]` in status line.
5. Add `mode?: ReadingMode` prop to HelpOverlay. Add `1-4` key descriptions. Differentiate step forward description by mode.
6. Update state label logic in App (or pass to screens) to include mode name in initial idle message for all modes.
7. Run all tests. `bun test` + `bun x tsc --noEmit`.

**Success criteria:** Mode indicator visible. Help overlay shows 1-4 keys and mode-specific step descriptions. State labels include mode name.

### Phase E: PTY Validation + Polish

**Goal:** End-to-end PTY validation and edge-case hardening.

**Tasks:**
1. Write PTY acceptance transcripts in `docs/validation/2026-03-06-runtime-mode-switching-acceptance-pty.md`.
2. PTY test: start in RSVP, advance, press `2` → verify chunked rendering + position.
3. PTY test: press `4` → verify scroll rendering + screen swap.
4. PTY test: press `1` → verify RSVP rendering + round-trip.
5. PTY test: verify mode indicator in status bar.
6. PTY test: press `?` → verify help shows 1-4 keys → close help → press `3`.
7. PTY test: rapid switch sequence → verify final state.
8. Edge case: single-word document + mode switch.
9. Edge case: finished state + mode switch.
10. Run full test suite: `bun test` + `bun x tsc --noEmit`.

**Success criteria:** All PTY transcripts pass. All edge cases handled. Zero test failures.

## Dependencies & Prerequisites

- **Prerequisite:** Shared mode-transform module extraction (Phase A). This unblocks clean state lifting and eliminates the transform duplication identified in todo #035.
- **Dependency:** Sub-phase 13 (guided scroll mode) must be complete. It is (`status: completed` in plan).
- **No external dependencies.** No new packages, no API changes, no configuration changes.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| State lifting breaks existing behavior | Medium | High | TDD-first with comprehensive existing test suite (250 tests). Refactor in small steps with tests green at each step. |
| Screen swap visual flicker | Low | Medium | Ink 6 reconciler handles conditional rendering well. PTY validation in Phase E catches any issues. Fallback: add React `key` prop to force clean mount. |
| Position drift on round-trip | Certain | Low | Documented as acceptable (±1 word). Agent API has same behavior. Future optimization possible with `sourceWords` metadata. |
| Timer race condition during mode switch | Low | Medium | Mode switch forces `"paused"` state, which triggers timer cleanup via effect dependency. React batches state updates, ensuring consistency. |
| Performance on large documents | Low | Low | Mode transforms are O(n), cached after first access. 10,000 words transforms in <1ms. |
| Scope creep into mode framework redesign | Medium | Medium | Stay within Phase 14 scope (see brainstorm: "this is about user-triggered runtime switching, not a broader mode framework redesign"). |

## Open Questions Status

All questions resolved during brainstorming and planning:

- **Where should state live?** In App, consistent with agent API pattern (see brainstorm: "App owns canonical words + mode cache").
- **Should session reset on switch?** No — persist session for TUI (documented divergence from agent API).
- **Where should 1-4 key handler live?** In App, with screens handling all other keys.
- **Same-mode re-selection?** No-op.
- **Mode switch during help overlay?** Blocked (consistent with current help overlay behavior).
- **Mode switch at finished state?** Allowed, preserves finished state at last index of new array.
- **Position mapping algorithm?** Progress ratio (matches agent API).

## Scope Boundaries (YAGNI)

- No mode-switching animation or transition effect.
- No user-configurable key bindings for mode switching.
- No mode-switching history or undo.
- No automatic mode recommendation.
- No broader mode framework redesign (see brainstorm: stay within Phase 14 scope).
- No session reset behavior change in agent API (TUI diverges; agent API can be updated separately if needed).

## AI-Era Notes

- The agent API (`src/agent/reader-api.ts`) is the reference implementation. Use it to verify TUI behavior during development.
- TDD-first discipline is mandatory despite AI acceleration. No implementation slice starts before failing contract tests exist.
- Shared module extraction (Phase A) is a clean, well-bounded refactoring task suitable for AI pair programming with confidence.
- State lifting (Phase B) is the highest-risk phase — review carefully for subtle behavioral changes in timer management and React lifecycle.

## Sources & References

### Origin

- **Brainstorm document:** `docs/brainstorms/2026-03-06-rfaf-phase-3-subphase-14-runtime-mode-switching-brainstorm.md`
  - Carried-forward decisions:
    - App-level runtime mode state (approach 1, chosen over screen-local and controller alternatives)
    - `1-4` keys for mode switching
    - Preserve reading place on switch
    - Pause on switch
    - App owns canonical words + mode cache
    - Explicit screen swap
    - Stay within Phase 14 scope

### Internal References

- Agent API runtime (blueprint): `src/agent/reader-api.ts:55-63` (`AgentReaderRuntime` interface)
- Agent API set_reading_mode: `src/agent/reader-api.ts:345-379`
- Agent API getWordsForMode: `src/agent/reader-api.ts:133-151`
- Agent API transformWordsForMode: `src/agent/reader-api.ts:104-114`
- Agent API position mapping: `src/agent/reader-api.ts:357-367`
- App component (current): `src/ui/App.tsx:15-37`
- RSVPScreen: `src/ui/screens/RSVPScreen.tsx:139-373`
- GuidedScrollScreen: `src/ui/screens/GuidedScrollScreen.tsx:153-441`
- HelpOverlay: `src/ui/components/HelpOverlay.tsx:8-23`
- StatusBar: `src/ui/components/StatusBar.tsx:21-38`
- ReadingMode type: `src/cli/mode-option.ts:1-3`
- Reading pipeline (transform duplication): `src/cli/reading-pipeline.ts:64-69`
- Reader state machine: `src/engine/reader.ts:5-12`
- Session tracking: `src/engine/session.ts`
- Transform duplication todo: `todos/035-pending-p3-shared-reading-mode-transform-contract.md`

### Institutional Learnings

- `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
- `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`
- `docs/solutions/ui-bugs/line-break-and-highlight-drift-guided-scroll-20260306.md`

### Related Work

- Guided scroll plan (sub-phase 13): `docs/plans/2026-03-06-feat-phase-3-subphase-13-guided-scroll-mode-plan.md`
- Chunked mode plan (sub-phase 11): `docs/plans/2026-03-05-feat-phase-3-subphase-11-chunked-reading-mode-plan.md`
- Bionic mode plan (sub-phase 12): `docs/plans/2026-03-06-feat-phase-3-subphase-12-bionic-reading-mode-plan.md`
- MVP scope brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`
