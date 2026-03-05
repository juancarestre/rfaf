---
title: "Institutional Learnings Analysis: rfaf Bun CLI/Ink TUI"
date: 2026-03-05
type: analysis
scope: "Bun CLI, Ink TUI, TTY/stdin handling, alternate screen, interactive key input, test strategy"
---

# Institutional Learnings Analysis: rfaf Bun CLI/Ink TUI

## Executive Summary

The **rfaf** codebase (Bun + Ink + TypeScript) demonstrates **mature patterns** for interactive terminal applications. This analysis compares current implementation against known best practices and identifies alignment/divergence points.

**Key Finding:** The implementation is **well-aligned** with established patterns for CLI/TUI applications. The team has made deliberate, documented choices that avoid common pitfalls.

---

## 1. TTY/Stdin Detection & Input Source Resolution

### Current Implementation

**File:** `src/ingest/detect.ts`

```typescript
export function isStdinPiped(): boolean {
  try {
    const stats = fstatSync(0);
    return stats.isFIFO() || stats.isFile();
  } catch {
    return false;
  }
}
```

**File:** `src/cli/index.tsx` (lines 26-32)

```typescript
function hasInteractiveStdin(): boolean {
  try {
    return fstatSync(0).isCharacterDevice();
  } catch {
    return false;
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Uses `fstatSync()` instead of `process.stdin.isTTY`**
   - `fstatSync(0)` is more reliable for detecting piped input
   - Handles edge cases where `process.stdin.isTTY` may be undefined
   - Documented in PLAN.md (line 414): "Use `fs.fstatSync(0)` to detect piped stdin (`isFIFO()` / `isFile()`) instead of relying on `process.stdin.isTTY`"

2. **Distinguishes between piped stdin and interactive stdin**
   - `isStdinPiped()` checks for FIFO or file (line 40)
   - `hasInteractiveStdin()` checks for character device (line 28)
   - This separation prevents race conditions where piped input is mistaken for interactive input

3. **Graceful fallback with try/catch**
   - Prevents crashes if file descriptor operations fail
   - Returns safe defaults (false) on error

### Divergence Points

❌ **Minor inconsistency:**
- Two separate functions (`isStdinPiped()` and `hasInteractiveStdin()`) serve similar purposes but check different conditions
- Could be unified into a single enum-returning function for clarity
- **Severity:** Low — current approach is explicit and testable

### Related Tests

**File:** `tests/ingest/detect.test.ts`

✅ All four input source scenarios are tested:
- File argument present
- File argument + piped stdin (warns)
- Piped stdin only
- No input (shows help)

---

## 2. Interactive Input Stream Acquisition

### Current Implementation

**File:** `src/cli/index.tsx` (lines 44-84)

```typescript
function getInteractiveInputStream(): {
  stdin?: NodeJS.ReadStream;
  cleanup: () => void;
} {
  if (hasInteractiveStdin()) {
    const nativeStdin = process.stdin as NodeJS.ReadStream & {
      setRawMode?: (mode: boolean) => void;
    };

    if (typeof nativeStdin.setRawMode === "function") {
      return { stdin: nativeStdin, cleanup: () => {} };
    }

    const ttyStdin = new ReadStream(0);
    return {
      stdin: ttyStdin,
      cleanup: () => {
        ttyStdin.destroy();
      },
    };
  }

  try {
    const fd = openSync("/dev/tty", "r");
    const ttyStdin = new ReadStream(fd);

    return {
      stdin: ttyStdin,
      cleanup: () => {
        ttyStdin.destroy();
        try {
          closeSync(fd);
        } catch {
          // fd might already be closed by stream destruction
        }
      },
    };
  } catch {
    return { cleanup: () => {} };
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Handles piped stdin + interactive keybindings**
   - When stdin is piped (e.g., `cat file | rfaf`), opens `/dev/tty` for interactive input
   - Documented in PLAN.md (line 415): "For `cat file | rfaf`, read content from stdin, then switch interactive input to `/dev/tty` for keybindings"
   - This is the **gold standard** for CLI tools that accept piped input but need keyboard control

2. **Proper resource cleanup**
   - Returns cleanup function to close file descriptors
   - Called in finally block (line 185) to ensure cleanup even on error
   - Handles edge case where fd might already be closed (line 76)

3. **Graceful degradation**
   - If `/dev/tty` is unavailable, returns empty stdin (no cleanup needed)
   - Allows error message to be shown before exit (line 166-168)

4. **Type-safe raw mode detection**
   - Checks for `setRawMode` function before calling it
   - Prevents crashes on platforms where raw mode is unavailable

### Divergence Points

⚠️ **Potential issue:**
- If `process.stdin.setRawMode` is available but `/dev/tty` fails, the code falls back to `new ReadStream(0)` which may not be interactive
- **Severity:** Low — the error message (line 166-168) will catch this and exit cleanly
- **Recommendation:** Add explicit logging if `/dev/tty` fallback is used (for debugging)

### Related Tests

**Status:** No unit tests for `getInteractiveInputStream()`
- This is acceptable because it's tightly coupled to OS-level file descriptor operations
- Validated via PTY acceptance tests (see section 7)

---

## 3. Alternate Screen Buffer Management

### Current Implementation

**File:** `src/cli/index.tsx` (lines 14-42)

```typescript
function useAlternateScreen(): boolean {
  if (process.env.RFAF_NO_ALT_SCREEN === "1") {
    return false;
  }

  try {
    return fstatSync(1).isCharacterDevice();
  } catch {
    return false;
  }
}

function enterAlternateScreen() {
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[?25l");
}

function exitAlternateScreen() {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[?1049l");
}
```

**Usage:** Lines 158-161, 186-188

```typescript
const alternateScreen = useAlternateScreen();
if (alternateScreen) {
  enterAlternateScreen();
}

// ... app runs ...

try {
  await app.waitUntilExit();
} finally {
  input.cleanup();
  if (alternateScreen) {
    exitAlternateScreen();
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Manual alternate screen control**
   - Documented in PLAN.md (line 413): "Use manual alternate-screen handling (`\x1b[?1049h` / `\x1b[?1049l`) with Ink `render()` to avoid React version conflicts from wrapper packages"
   - Avoids dependency on `fullscreen-ink` which can conflict with Ink 6
   - Direct ANSI escape codes are more reliable

2. **Proper sequence order**
   - Enter: `\x1b[?1049h` (alt screen) then `\x1b[?25l` (hide cursor)
   - Exit: `\x1b[?25h` (show cursor) then `\x1b[?1049l` (normal screen)
   - Correct order prevents cursor flicker

3. **Test mode support**
   - `RFAF_NO_ALT_SCREEN=1` environment variable disables alternate screen
   - Documented in validation notes (line 35): "Added `RFAF_NO_ALT_SCREEN=1` test mode to make PTY output assertions stable"
   - Allows deterministic testing without alternate screen side effects

4. **Guaranteed cleanup**
   - Wrapped in finally block (line 184-189)
   - Ensures terminal is restored even if app crashes
   - Critical for preventing "stuck" terminal state

### Divergence Points

❌ **No divergence detected**
- Implementation is textbook correct for manual alternate screen handling

### Related Tests

**Validation:** `docs/validation/2026-03-05-acceptance-pty.md`

✅ Acceptance criteria verified:
- Line 31: "Alternate screen enter/exit sequences are emitted and restored on quit"
- Tested via Python PTY harness with ANSI output capture

---

## 4. Ink TUI Configuration & Rendering

### Current Implementation

**File:** `src/cli/index.tsx` (lines 171-180)

```typescript
const app = render(
  <App words={words} initialWpm={wpm} sourceLabel={document.source} />,
  {
    stdin: input.stdin,
    exitOnCtrlC: true,
    patchConsole: true,
    maxFps: 60,
    incrementalRendering: true,
  }
);
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Ink 6 specific configuration**
   - Uses `maxFps: 60` and `incrementalRendering: true` (Ink 6 features)
   - Documented in PLAN.md (line 412): "Ink v6, not v5: The original PLAN.md references `ink@^5`, but current is **v6.8.0**. Key v6 features used: `incrementalRendering` and `maxFps`"
   - These settings reduce flicker and improve rendering performance

2. **Proper stdin handling**
   - Passes custom `stdin` stream (from `getInteractiveInputStream()`)
   - Allows Ink to receive keyboard input from `/dev/tty` when stdin is piped

3. **Console patching**
   - `patchConsole: true` redirects console.log/error to Ink's output
   - Prevents console output from breaking the TUI layout

4. **Ctrl+C handling**
   - `exitOnCtrlC: true` allows clean exit on Ctrl+C
   - Cleanup happens in finally block (line 184-189)

### Divergence Points

⚠️ **Minor consideration:**
- `maxFps: 60` is reasonable but not validated for actual rendering performance
- Spike validation (line 27-32) targets 500+ WPM (~120ms per word)
- At 60 FPS, frame time is ~16.7ms, which is well below 120ms
- **Severity:** Very low — current setting is conservative and safe

### Related Tests

**Validation:** `docs/validation/2026-03-05-ink-spike.md`

✅ Spike validated:
- Ink can render single-word updates without flicker
- Alternate screen handling works correctly
- No layout shift observed

---

## 5. Interactive Key Input Handling

### Current Implementation

**File:** `src/ui/screens/RSVPScreen.tsx` (lines 100+)

Uses Ink's `useInput` hook (not shown in excerpt, but referenced in PLAN.md line 510).

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Ink's `useInput` hook**
   - Documented in PLAN.md (line 510): "Ink 6 docs: `maxFps`, `incrementalRendering`, `useInput` hook, synchronized output"
   - Provides event-driven keyboard input without raw mode complexity
   - Ink handles raw mode internally

2. **Keybinding design**
   - Documented in PLAN.md (line 292): "Ctrl+C: Clean exit via Ink's `exitOnCtrlC`"
   - Space: play/pause
   - Arrow keys: step forward/backward
   - `?`: help overlay
   - `q`: quit
   - `r`: restart
   - All keybindings are single-key (no complex chords)

### Divergence Points

❌ **No unit tests for key input handling**
- `useInput` is a React hook, difficult to test in isolation
- Validated via PTY acceptance tests (see section 7)
- **Severity:** Low — integration tests cover this adequately

### Related Tests

**Validation:** `docs/validation/2026-03-05-acceptance-pty.md`

✅ All keybindings validated:
- Line 25: "`?` shows help overlay and pauses playback"
- Line 28: "`q` quits cleanly from normal and finished states"
- Line 29: "`Ctrl+C` exits cleanly"

---

## 6. Test Strategy

### Current Implementation

**Test Framework:** Bun's built-in test runner (`bun:test`)

**Test Files:**
- `tests/ingest/detect.test.ts` — Input source detection
- `tests/ingest/plaintext.test.ts` — File reading
- `tests/processor/tokenizer.test.ts` — Text tokenization
- `tests/processor/pacer.test.ts` — Timing calculations
- `tests/engine/reader.test.ts` — State machine
- `tests/engine/session.test.ts` — Session tracking
- `tests/ui/orp.test.ts` — ORP lookup table
- `tests/ui/word-display.test.tsx` — Word display layout

**Test Coverage:** ~8 test files covering core logic

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **TDD-first approach**
   - Documented in PLAN.md (line 300): "every module must be built test-first using TDD (Test-Driven Development)"
   - Tests exist for all business logic modules
   - Tests use Bun's native test runner (no external framework)

2. **Unit tests for pure functions**
   - `tokenizer.test.ts` — Pure text processing
   - `pacer.test.ts` — Pure timing calculations
   - `orp.test.ts` — Pure lookup table validation
   - `word-display.test.tsx` — Pure layout calculations

3. **Integration tests for state machines**
   - `reader.test.ts` — Reader state transitions
   - `session.test.ts` — Session state tracking

4. **Input/output tests**
   - `detect.test.ts` — All four input source scenarios
   - `plaintext.test.ts` — File reading + error cases

### Divergence Points

⚠️ **Gaps in test coverage:**

1. **No unit tests for CLI entry point**
   - `src/cli/index.tsx` is not unit tested
   - Reason: Tightly coupled to OS-level operations (file descriptors, process.argv)
   - **Mitigation:** Validated via PTY acceptance tests

2. **No unit tests for Ink components**
   - `RSVPScreen.tsx`, `WordDisplay.tsx`, etc. are not unit tested
   - Reason: React components with hooks are difficult to test in isolation
   - **Mitigation:** Validated via PTY acceptance tests

3. **No unit tests for stdin reading**
   - `src/ingest/stdin.ts` is not unit tested
   - Reason: Requires mocking `Bun.stdin.text()`
   - **Severity:** Low — logic is trivial (3 lines of code)

### Acceptance Testing Strategy

**File:** `docs/validation/2026-03-05-acceptance-pty.md`

✅ **Comprehensive PTY-based acceptance testing:**
- Python PTY harness simulates real terminal environment
- Tests interactive keybindings, window resize, ANSI output
- Validates all 11 acceptance criteria
- Uses `RFAF_NO_ALT_SCREEN=1` for deterministic output assertions

**Recommendation:** This is the **correct approach** for CLI/TUI applications. Unit testing Ink components is less valuable than end-to-end PTY testing.

---

## 7. Stdin Handling: Piped Input + Interactive Control

### Current Implementation

**File:** `src/ingest/stdin.ts`

```typescript
export async function readStdin(): Promise<Document> {
  const content = await Bun.stdin.text();

  if (!content.trim()) {
    throw new Error("File is empty");
  }

  return {
    content,
    source: "stdin",
    wordCount: countWords(content),
  };
}
```

**File:** `src/cli/index.tsx` (lines 140-150)

```typescript
let document: Awaited<ReturnType<typeof readPlaintextFile>>;
if (source.kind === "file") {
  document = await readPlaintextFile(source.path);
} else {
  try {
    document = await readStdin();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "File is empty") {
      parser.showHelp();
      process.exit(0);
    }
    throw error;
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Bun.stdin.text() for piped input**
   - Uses Bun's native async stdin API
   - Documented in PLAN.md (line 133): "Read all piped input via `await Bun.stdin.text()`"
   - More efficient than Node's stream-based approach

2. **Proper error handling**
   - Detects empty input and shows help
   - Distinguishes between empty input (show help) and other errors (throw)

3. **Stdin + interactive keybindings**
   - After reading stdin (line 141), code acquires interactive input stream (line 163)
   - Documented in PLAN.md (line 415): "For `cat file | rfaf`, read content from stdin, then switch interactive input to `/dev/tty` for keybindings"
   - This is the **correct pattern** for CLI tools

### Divergence Points

❌ **No divergence detected**
- Implementation is correct and well-documented

### Related Tests

**Validation:** `docs/validation/2026-03-05-acceptance-pty.md`

✅ Piped stdin validated:
- Line 22: "Piped stdin starts paused with `source=stdin`"
- Tested via Python PTY harness with `echo "text" | rfaf`

---

## 8. Error Handling & Exit Codes

### Current Implementation

**File:** `src/cli/index.tsx` (lines 192-201)

```typescript
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);

  if (message.includes("--wpm")) {
    process.exit(2);
  }

  process.exit(1);
});
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Proper exit codes**
   - Exit code 0: Success
   - Exit code 1: Generic error
   - Exit code 2: Argument validation error (--wpm)
   - Follows Unix convention

2. **Error messages to stderr**
   - Uses `process.stderr.write()` instead of console.log
   - Prevents error messages from being captured as output

3. **Type-safe error handling**
   - Checks `error instanceof Error` before accessing `.message`
   - Falls back to `String(error)` for non-Error objects

### Divergence Points

⚠️ **Minor improvement opportunity:**
- Exit code 2 is only used for `--wpm` validation
- Other validation errors (e.g., file not found) use exit code 1
- **Severity:** Very low — current approach is acceptable

---

## 9. Bun-Specific Patterns

### Current Implementation

**File:** `src/cli/index.tsx` (line 1)

```typescript
#!/usr/bin/env bun
```

**File:** `package.json`

```json
{
  "type": "module",
  "main": "src/cli/index.tsx",
  "bin": {
    "rfaf": "src/cli/index.tsx"
  },
  "scripts": {
    "start": "bun run src/cli/index.tsx",
    "test": "bun test"
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **Shebang for direct execution**
   - `#!/usr/bin/env bun` allows `./src/cli/index.tsx` to be executed directly
   - Requires `chmod +x src/cli/index.tsx`

2. **ESM module type**
   - `"type": "module"` enables ES6 imports
   - Bun natively supports TypeScript + JSX without build step

3. **No build step for development**
   - Documented in PLAN.md (line 418): "No build step for dev: Bun natively handles TypeScript + JSX. Just `bun run src/cli/index.tsx`"
   - Dramatically speeds up development iteration

4. **Bun test runner**
   - Uses `bun:test` (Bun's built-in test framework)
   - No external test framework needed
   - Documented in PLAN.md (line 300): "Use Bun's built-in test runner (`bun test`)"

### Divergence Points

❌ **No divergence detected**
- Bun patterns are correctly applied

---

## 10. React 19 + Ink 6 Compatibility

### Current Implementation

**File:** `package.json`

```json
{
  "dependencies": {
    "ink": "^6.0.0",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0"
  }
}
```

### Pattern Analysis

✅ **ALIGNED with best practices:**

1. **React 19 required for Ink 6**
   - Documented in PLAN.md (line 417): "React 19 required: Ink 6 uses React 19 in this setup; keep `react` and `@types/react` aligned"
   - Ink 6 dropped support for React 18

2. **Version alignment**
   - `react` and `@types/react` are both v19
   - Prevents type mismatches

### Divergence Points

❌ **No divergence detected**
- Dependency versions are correctly aligned

---

## Summary Table: Alignment vs. Divergence

| Area | Status | Notes |
|------|--------|-------|
| **TTY/stdin detection** | ✅ Aligned | Uses `fstatSync()` instead of `process.stdin.isTTY` |
| **Interactive input stream** | ✅ Aligned | Handles piped stdin + `/dev/tty` fallback correctly |
| **Alternate screen** | ✅ Aligned | Manual ANSI control, proper cleanup, test mode support |
| **Ink configuration** | ✅ Aligned | Ink 6 features enabled, proper stdin passing |
| **Key input handling** | ✅ Aligned | Uses Ink's `useInput` hook, all keybindings validated |
| **Test strategy** | ⚠️ Partial | Unit tests for logic, PTY tests for integration. No unit tests for CLI/Ink components (acceptable) |
| **Stdin handling** | ✅ Aligned | Bun.stdin.text(), proper error handling, interactive fallback |
| **Error handling** | ✅ Aligned | Proper exit codes, stderr output, type-safe |
| **Bun patterns** | ✅ Aligned | ESM, no build step, native TypeScript/JSX |
| **React 19 + Ink 6** | ✅ Aligned | Versions correctly aligned |

---

## Recommendations

### High Priority (Do Now)

1. **Add logging for `/dev/tty` fallback** (Section 2)
   - If `/dev/tty` fails, log a debug message
   - Helps troubleshoot interactive input issues

2. **Document test strategy** (Section 6)
   - Add comment in `tests/` directory explaining why Ink components aren't unit tested
   - Reference PTY acceptance tests as the validation strategy

### Medium Priority (Nice to Have)

3. **Unify stdin detection functions** (Section 1)
   - Combine `isStdinPiped()` and `hasInteractiveStdin()` into single enum-returning function
   - Improves code clarity without changing behavior

4. **Add stdin reading unit test** (Section 6)
   - Mock `Bun.stdin.text()` and test empty input handling
   - Low effort, high clarity

### Low Priority (Future)

5. **Expand exit code strategy** (Section 8)
   - Use exit code 2 for all validation errors, not just `--wpm`
   - Aligns with Unix conventions

---

## Conclusion

The **rfaf** codebase demonstrates **excellent engineering practices** for interactive CLI/TUI applications. The team has:

- ✅ Made deliberate, documented choices (PLAN.md is comprehensive)
- ✅ Avoided common pitfalls (proper TTY detection, alternate screen cleanup, stdin + interactive input)
- ✅ Chosen appropriate testing strategies (unit tests for logic, PTY tests for integration)
- ✅ Aligned with Bun and Ink 6 best practices
- ✅ Maintained code clarity and error handling

**No critical issues detected.** The implementation is production-ready and well-positioned for future enhancements.

---

## References

- **PLAN:** `docs/plans/2026-03-04-feat-rsvp-speed-reading-mvp-plan.md`
- **Validation:** `docs/validation/2026-03-05-acceptance-pty.md`
- **Spike:** `docs/validation/2026-03-05-ink-spike.md`
- **Review Config:** `compound-engineering.local.md`
