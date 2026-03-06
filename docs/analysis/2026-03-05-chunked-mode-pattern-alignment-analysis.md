# Chunked Mode + Summary Compatibility: Pattern Analysis Report

## Executive Summary

Branch `feat/chunked-mode-phase3-sub11` implements chunked reading mode with summary compatibility. Analysis against documented patterns shows **strong alignment** with established hardening practices, with **one notable divergence** in error handling scope.

**Key Finding**: The implementation successfully applies patterns from Phase 2 hardening (summary flow, terminal safety, input bounds) but introduces a new architectural pattern (reading pipeline composition) that extends beyond existing documented patterns.

---

## Institutional Learnings Found

### 1. Summary Flow Nondeterminism & Hardening (HIGH RELEVANCE)
- **File**: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- **Module**: CLI Runtime
- **Problem Type**: logic_error
- **Severity**: high
- **Tags**: summary-flow, cli-determinism, agent-parity, retry-bounds, lazy-loading

#### Relevance to Branch
This pattern directly addresses summary flow correctness and is foundational to the chunked mode implementation. The branch builds on Phase 2 hardening.

#### Key Insights from Pattern
1. **Deterministic parse boundary**: Parsing must use argv semantics, not filesystem state
2. **Parity boundary**: Summarize capability must be exposed to both CLI and agent interfaces
3. **Safety boundary**: Final rendered errors must be sanitized/redacted before terminal output
4. **Failure-policy boundary**: Retries are bounded and controlled; timeout/retry config is clamped
5. **Performance boundary**: Summarize stack is loaded only when needed (lazy imports)

#### Branch Alignment Analysis

✅ **ALIGNED**:
- Summary flow is lazy-loaded in `reading-pipeline.ts` (line 45-46)
- Deterministic mode resolution in `mode-option.ts` (no filesystem probing)
- Summary failures still prevent playback start (reading-pipeline.ts enforces order)
- Config bounds respected (uses existing `MAX_SUMMARIZE_TIMEOUT_MS`, `MAX_SUMMARIZE_RETRIES`)

✅ **EXTENDS PATTERN**:
- Introduces `buildReadingPipeline()` as a composition layer that orchestrates: summarize → tokenize → chunk
- This is a new architectural pattern not previously documented
- Dependency injection in `ReadingPipelineDeps` allows testability (good practice)

**Code Reference**:
```ts
// src/cli/reading-pipeline.ts lines 36-61
const summaryResult = input.summaryOption.enabled ? ... : { readingContent, sourceLabel };
const tokenized = tokenizeFn(summaryResult.readingContent);
const words = input.mode === "chunked" ? chunkFn(tokenized) : tokenized;
```

---

### 2. Terminal Startup Lifecycle & Input Hardening (MEDIUM RELEVANCE)
- **File**: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- **Module**: CLI Runtime
- **Problem Type**: runtime_error
- **Severity**: high
- **Tags**: terminal-lifecycle, ansi-injection, input-size-limit, cli-safety, tdd

#### Relevance to Branch
Chunked mode extends the reading UI surface. Terminal safety patterns apply to chunk rendering.

#### Key Insights from Pattern
1. **Lifecycle wrapper**: Guarantees cleanup and terminal restoration on all startup paths
2. **Text sanitization**: Centralized terminal text sanitization at rendering boundaries
3. **Input size guards**: Shared ingest byte-limit guards for file and stdin ingestion

#### Branch Alignment Analysis

✅ **ALIGNED**:
- No new input ingestion paths introduced (chunking operates on already-ingested content)
- Terminal lifecycle ownership remains in `src/cli/session-lifecycle.ts` (unchanged)
- Chunk text is derived from tokenized words (already sanitized upstream)

⚠️ **POTENTIAL GAP**:
- Chunk display text is constructed in `chunker.ts` line 49: `text: chunkWords.map((word) => word.text).join(" ")`
- This assumes upstream word text is already sanitized
- **No explicit validation** that chunk text respects terminal safety boundaries
- **Recommendation**: Add assertion in `toChunkWord()` that chunk text doesn't contain ANSI/OSC sequences

**Code Reference**:
```ts
// src/processor/chunker.ts lines 40-56
function toChunkWord(chunkWords: Word[], chunkIndex: number): Word {
  // ... no explicit sanitization check
  return {
    text: chunkWords.map((word) => word.text).join(" "),
    // ...
  };
}
```

---

### 3. RSVP Words Vertical Centering (LOW RELEVANCE)
- **File**: `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`
- **Module**: RSVP UI
- **Problem Type**: ui_bug
- **Severity**: medium
- **Tags**: ink-layout, terminal-ui, rsvp, text-scale, regression, flexbox

#### Relevance to Branch
Chunked mode reuses the same reading lane layout. Layout pattern applies to chunk display.

#### Key Insights from Pattern
1. **Explicit flexDirection**: Always set `flexDirection` explicitly for layout-critical Ink containers
2. **Axis separation**: Keep one concern per axis (parent for vertical, child for horizontal)
3. **Regression tests**: Assert rendered word line is near expected vertical midpoint

#### Branch Alignment Analysis

✅ **ALIGNED**:
- Branch does NOT modify reading lane layout (uses existing `getReadingLaneLayout()`)
- Chunk display inherits existing vertical centering from RSVP screen
- Tests added for chunk layout (`tests/ui/chunked-screen-layout.test.tsx`)

✅ **EXTENDS PATTERN**:
- New test file validates chunk display remains centered
- `getRemainingSeconds()` function added to handle chunk-aware time calculation

**Code Reference**:
```ts
// src/ui/screens/RSVPScreen.tsx lines 263-269
const remainingSeconds = getRemainingSeconds(
  words,
  reader.currentIndex,
  reader.currentWpm
);
```

---

## Pattern Divergences & Gaps

### Divergence 1: Error Handling Scope in Reading Pipeline

**Pattern Expectation** (from summary hardening):
- Error sanitization happens at terminal boundary
- Retry policy is bounded and controlled
- Transient failures have backoff+jitter

**Branch Implementation**:
- `buildReadingPipeline()` does NOT add new error handling
- Relies entirely on existing `summarizeBeforeRsvp()` error handling
- No new retry logic for chunking failures (chunking is deterministic, so this is acceptable)

**Assessment**: ✅ ACCEPTABLE
- Chunking is a deterministic transform (no I/O, no retries needed)
- Summary errors are already handled by Phase 2 hardening
- No new error paths introduced

**Code Reference**:
```ts
// src/cli/reading-pipeline.ts lines 36-54
// Error handling delegated to summarizeBeforeRsvp
const summaryResult = input.summaryOption.enabled
  ? await (async () => {
      const summarize = deps.summarizeBefore ?? (async (summarizeInput) => {
        const { summarizeBeforeRsvp } = await import("./summarize-flow");
        return summarizeBeforeRsvp(summarizeInput);
      });
      return summarize({ ... });
    })()
  : { readingContent: input.documentContent, sourceLabel: input.sourceLabel };
```

---

### Divergence 2: Pacing Calculation for Chunks

**Pattern Expectation** (from summary hardening):
- WPM semantics remain consistent across modes
- Pacing is deterministic and testable

**Branch Implementation**:
- New `getRemainingSeconds()` function in RSVPScreen
- Chunk pacing derived from source word timings via `getDisplayTime()`
- Pacer updated to handle `sourceWords` array

**Assessment**: ✅ WELL-DESIGNED
- Pacing is WPM-compatible (uses same `getDisplayTime()` calculation)
- Chunk dwell time = sum of source word dwell times (mathematically sound)
- Tests added for chunk pacing (`tests/processor/chunked-pacer.test.ts`)

**Code Reference**:
```ts
// src/processor/pacer.ts lines 33-40
export function getDisplayTime(word: Word, wpm: number): number {
  if (word.sourceWords && word.sourceWords.length > 0) {
    return word.sourceWords.reduce(
      (total, sourceWord) => total + getDisplayTime(sourceWord, wpm),
      0
    );
  }
  // ... rest of calculation
}
```

---

## New Architectural Pattern: Reading Pipeline Composition

The branch introduces a new pattern not previously documented:

### Pattern: Composable Reading Pipeline

**Definition**: A pipeline that orchestrates sequential transforms (summarize → tokenize → chunk) with dependency injection for testability.

**Implementation**:
```ts
// src/cli/reading-pipeline.ts
export async function buildReadingPipeline(
  input: ReadingPipelineInput,
  deps: ReadingPipelineDeps = {}
): Promise<ReadingPipelineResult>
```

**Strengths**:
1. ✅ Testable: Dependencies can be mocked
2. ✅ Composable: New modes can be added without modifying CLI
3. ✅ Order-enforced: Summarize always happens before tokenize/chunk
4. ✅ Lazy-loaded: Heavy imports only when needed

**Potential Concerns**:
1. ⚠️ Not yet documented as a pattern (should be captured for future modes)
2. ⚠️ Assumes all transforms are idempotent (true for current implementation, but not enforced)

**Recommendation**: Capture this as a pattern in `docs/solutions/best-practices/` for future mode additions.

---

## Test Coverage Analysis

### Tests Added in Branch

| Test File | Coverage | Pattern Alignment |
|-----------|----------|-------------------|
| `tests/cli/chunked-cli-contract.test.ts` | Mode resolution, error handling | ✅ Deterministic parsing |
| `tests/cli/mode-args.test.ts` | Argument parsing | ✅ Argv-only semantics |
| `tests/cli/summary-chunked-flow.test.ts` | Pipeline composition | ✅ Order enforcement |
| `tests/processor/chunker.test.ts` | Chunking logic | ✅ No dropped/duplicated words |
| `tests/processor/chunked-pacer.test.ts` | Pacing calculation | ✅ WPM compatibility |
| `tests/ui/chunked-screen-layout.test.tsx` | Layout stability | ✅ Vertical centering |
| `tests/ui/rsvp-screen-remaining-time.test.ts` | Time calculation | ✅ Chunk-aware timing |

**Assessment**: ✅ COMPREHENSIVE
- All critical paths have test coverage
- TDD approach followed (tests added alongside implementation)
- No gaps in contract testing

---

## Validation Against Phase 2 Hardening Checklist

From `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`:

| Hardening Item | Status | Evidence |
|---|---|---|
| Deterministic argv-only normalization | ✅ | `mode-option.ts` uses `resolveReadingMode()` |
| Summarize parity to agent API | ✅ | `buildReadingPipeline()` supports both CLI and agent paths |
| Sanitized final CLI error output | ✅ | Inherited from Phase 2 (no new error paths) |
| Bounded config validation | ✅ | Uses existing `MAX_SUMMARIZE_TIMEOUT_MS`, `MAX_SUMMARIZE_RETRIES` |
| Retry backoff+jitter | ✅ | Inherited from Phase 2 (no new retries) |
| Lazy-loaded summarize flow | ✅ | `reading-pipeline.ts` line 45 uses dynamic import |
| Explicit cleanup paths | ✅ | No new lifecycle changes (uses existing session-lifecycle) |

**Overall Assessment**: ✅ FULLY COMPLIANT

---

## Recommendations

### 1. Document the Reading Pipeline Pattern (MEDIUM PRIORITY)
**Action**: Create `docs/solutions/best-practices/reading-pipeline-composition-pattern.md`
**Rationale**: Future modes (e.g., "speed-boost", "study-mode") will reuse this pattern
**Content**: Document the pattern, dependency injection approach, and order-enforcement guarantees

### 2. Add Terminal Safety Assertion in Chunker (LOW PRIORITY)
**Action**: Add validation in `toChunkWord()` to assert chunk text doesn't contain ANSI sequences
**Rationale**: Defense-in-depth against upstream sanitization failures
**Code**:
```ts
function toChunkWord(chunkWords: Word[], chunkIndex: number): Word {
  // ... existing code ...
  const chunkText = chunkWords.map((word) => word.text).join(" ");
  
  // Validate no ANSI/OSC sequences leaked through
  if (ANSI_OSC_SEQUENCE.test(chunkText) || ANSI_CSI_SEQUENCE.test(chunkText)) {
    throw new Error("Chunk text contains unsafe ANSI sequences");
  }
  
  return { text: chunkText, ... };
}
```

### 3. Update PTY Validation Documentation (LOW PRIORITY)
**Action**: Expand `docs/validation/2026-03-05-acceptance-pty.md` with chunked+summary edge cases
**Rationale**: Already partially done (section added), but could include:
- Chunk display under various terminal widths
- Summary timeout behavior in chunked mode
- Chunk boundary behavior with unusual punctuation

### 4. Consider Agent API Parity for Chunked Mode (FUTURE)
**Action**: Plan for agent API exposure of chunked mode (Phase 3 item 14)
**Rationale**: Follows pattern from summary flow parity
**Note**: Not required for sub-phase 11, but should be tracked

---

## Summary Table: Alignment vs. Divergence

| Pattern | Alignment | Divergence | Risk |
|---------|-----------|-----------|------|
| Summary Flow Hardening | ✅ Strong | None | Low |
| Terminal Lifecycle Safety | ✅ Strong | Chunk text validation gap | Low |
| RSVP Layout Stability | ✅ Strong | None | Low |
| Error Handling Scope | ✅ Acceptable | Relies on Phase 2 | Low |
| Pacing Calculation | ✅ Well-designed | New chunk pacing logic | Low |
| **Reading Pipeline Composition** | ✅ New Pattern | Not yet documented | Medium |

**Overall Risk Assessment**: 🟢 LOW
- All critical patterns are followed
- No violations of established boundaries
- New pattern is well-designed but should be documented

---

## Links to Related Documentation

### Patterns
- Summary Flow: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- Terminal Safety: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- Layout Stability: `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`

### Planning & Validation
- Chunked Mode Plan: `docs/plans/2026-03-05-feat-phase-3-subphase-11-chunked-reading-mode-plan.md`
- Brainstorm: `docs/brainstorms/2026-03-05-rfaf-phase-3-subphase-11-chunked-mode-brainstorm.md`
- PTY Validation: `docs/validation/2026-03-05-acceptance-pty.md`

### Implementation Files
- Mode Resolution: `src/cli/mode-option.ts`
- Pipeline Composition: `src/cli/reading-pipeline.ts`
- Chunking Logic: `src/processor/chunker.ts`
- Pacing: `src/processor/pacer.ts`
- UI Integration: `src/ui/screens/RSVPScreen.tsx`

### Test Files
- CLI Contract: `tests/cli/chunked-cli-contract.test.ts`
- Pipeline: `tests/cli/summary-chunked-flow.test.ts`
- Chunker: `tests/processor/chunker.test.ts`
- Pacing: `tests/processor/chunked-pacer.test.ts`
- Layout: `tests/ui/chunked-screen-layout.test.tsx`
