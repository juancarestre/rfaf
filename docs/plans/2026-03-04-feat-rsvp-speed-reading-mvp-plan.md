---
title: "feat: RSVP Speed-Reading MVP"
type: feat
status: completed
date: 2026-03-04
origin: docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md
---

# feat: RSVP Speed-Reading MVP

## Overview

Build the Phase 1 MVP of **rfaf** ("Read Fast As F*ck") — a CLI/TUI speed-reading tool focused on an excellent RSVP (Rapid Serial Visual Presentation) experience. The MVP accepts plaintext files and piped stdin, displays words one at a time with ORP (Optimal Recognition Point) highlighting, and provides precise speed/navigation controls.

This is a greenfield Bun + TypeScript project targeting a shareable GitHub release (see brainstorm: `docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md`).

## Problem Statement / Motivation

Speed-reading tools like ReadFast.ai exist as web apps but there's no good open-source, local-first CLI alternative. Developers and power users who live in the terminal lack a tool to quickly consume articles, documentation, or text content at accelerated reading speeds. RSVP is a proven technique for 2-4x reading speed improvement.

## Proposed Solution

A tight MVP with 7 components, built in this order:

### Phase 0: Ink Validation Spike (~30 min)

Before building anything, validate that Ink 6 with manual alternate-screen handling can render a single word updating at 500+ WPM without flicker (see brainstorm: resolved question on Ink validation).

**Spike scope:**
- Render a fullscreen Ink app with a single `<Text>` element
- Update the text content via `setTimeout` at 120ms intervals (~500 WPM)
- Verify: no flicker, no layout shift, clean alternate screen buffer entry/exit
- Test with `incrementalRendering: true` and `maxFps: 60`

Spike artifact: `scripts/ink-spike.tsx` with notes in `docs/validation/2026-03-05-ink-spike.md`.

**If the spike fails:** Fall back to raw ANSI escape codes (proven approach from `speedread` tool — direct cursor positioning with `\033[row;colH`).

### Phase 1: Project Scaffolding

```
rfaf/
├── src/
│   ├── cli/
│   │   └── index.tsx          # Entry point + yargs parsing
│   ├── ingest/
│   │   ├── types.ts           # Document interface
│   │   ├── plaintext.ts       # Read .txt files
│   │   ├── stdin.ts           # Read piped stdin
│   │   └── detect.ts          # Auto-detect input source
│   ├── processor/
│   │   ├── tokenizer.ts       # Text -> Word[] with metadata
│   │   └── pacer.ts           # WPM + timing calculations
│   ├── engine/
│   │   ├── reader.ts          # Core state machine
│   │   └── session.ts         # Session tracking (time, progress)
│   └── ui/
│       ├── App.tsx            # Root Ink component
│       ├── screens/
│       │   └── RSVPScreen.tsx # Main RSVP display
│       └── components/
│           ├── WordDisplay.tsx # Word + ORP highlighting
│           ├── ProgressBar.tsx # Reading progress
│           ├── StatusBar.tsx   # WPM, time remaining, state
│           └── HelpOverlay.tsx # Keybinding help (? key)
├── tests/
│   ├── processor/
│   │   ├── tokenizer.test.ts  # Tokenization + punctuation detection
│   │   └── pacer.test.ts      # Timing calculations
│   ├── engine/
│   │   ├── reader.test.ts     # State machine transitions
│   │   └── session.test.ts    # Session tracking
│   ├── ingest/
│   │   ├── plaintext.test.ts  # File reading + error cases
│   │   └── detect.test.ts     # Input source detection
│   └── ui/
│       └── orp.test.ts          # ORP lookup table validation
├── package.json
├── tsconfig.json
└── bunfig.toml
```

**Dependencies (MVP only):**
```json
{
  "dependencies": {
    "ink": "^6.0.0",
    "react": "^19.0.0",
    "yargs": "^17.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

Note: Ink is at **v6.8.0** (not v5 as referenced in PLAN.md). Use `ink@^6`.

### Phase 2: CLI Entry Point (`src/cli/index.tsx`)

Parse arguments with yargs, then hand off to the Ink app:

```bash
rfaf <file>             # Read a plaintext file
rfaf --wpm 350          # Set target speed (default: 300)
cat text.txt | rfaf     # Read piped stdin
rfaf                    # No input → show help (same as --help)
rfaf --help             # Show help
rfaf --version          # Show version
```

**Input resolution logic:**
1. If file argument provided → read file (ignore stdin even if piped, warn to stderr)
2. Else if stdin is piped (`!process.stdin.isTTY`) → read stdin via `Bun.stdin.text()`
3. Else → show help text, exit 0

**`--wpm` validation:** Must be integer in range 50–1500. Error with exit code 2 if invalid.

### Phase 3: Ingestion Layer (`src/ingest/`)

**`types.ts` — Document interface:**
```typescript
interface Document {
  content: string;       // Raw text content
  source: string;        // File path or "stdin"
  wordCount: number;     // Total words after tokenization
}
```

**`plaintext.ts`:** Read file via `Bun.file(path).text()`. Check existence with `file.exists()`. Detect binary by scanning first 8KB for null bytes. Assume UTF-8.

**`stdin.ts`:** Read all piped input via `await Bun.stdin.text()`.

**`detect.ts`:** Check `process.stdin.isTTY` and `process.argv` to determine input source.

### Phase 4: Tokenizer + Pacer (`src/processor/`)

**`tokenizer.ts` — Split text into words with metadata:**

```typescript
interface Word {
  text: string;              // The word itself
  index: number;             // Position in word array (0-based)
  paragraphIndex: number;    // Which paragraph this word belongs to
  isParagraphStart: boolean; // First word of a paragraph
  trailingPunctuation: PunctuationTier | null;
}

type PunctuationTier = 'sentence_end' | 'clause_break' | 'paragraph_break';
```

**Tokenization rules:**
- Split on whitespace (simple, predictable)
- Paragraph breaks = `\n\n` or more consecutive newlines (collapse multiples)
- Trim leading/trailing whitespace; if empty after trim → error "File is empty"
- Hyphenated words stay as one token
- URLs, numbers, contractions stay as one token

**Punctuation detection tiers:**
| Tier | Characters | Multiplier |
|------|-----------|-----------|
| `sentence_end` | `.` `!` `?` (including `."` `!'` `?"`) | 3.0x |
| `clause_break` | `,` `;` `:` | 2.0x |
| `paragraph_break` | `\n\n+` boundary | 4.0x |

**`pacer.ts` — Calculate display time per word:**

Based on the `speedread` timing model:

```typescript
function getDisplayTime(word: Word, wpm: number): number {
  const baseMs = 60_000 / wpm;

  // Punctuation multiplier
  let multiplier = 0.9; // Slight speedup for plain words
  if (word.trailingPunctuation === 'sentence_end') multiplier = 3.0;
  else if (word.trailingPunctuation === 'clause_break') multiplier = 2.0;

  // Word-length penalty: sqrt(length) * factor
  const lengthPenalty = Math.sqrt(word.text.length) * 0.04;

  let duration = (multiplier + lengthPenalty) * baseMs;

  // Paragraph break: add extra pause
  if (word.trailingPunctuation === 'paragraph_break') {
    duration += 4.0 * baseMs;
  }

  // First word minimum: 200ms
  if (word.index === 0) {
    duration = Math.max(duration, 200);
  }

  return duration;
}
```

### Phase 5: Reading Engine (`src/engine/`)

**`reader.ts` — Core state machine:**

States: `idle` → `paused` → `playing` → `paused` (loop) → `finished`

```
                ┌──────────────────────────────────────────┐
                │                                          │
  ┌─────┐  load  ┌────────┐  Space   ┌─────────┐  last   ┌──────────┐
  │ idle │──────>│ paused │────────>│ playing │──word──>│ finished │
  └─────┘       └────────┘<────────└─────────┘        └──────────┘
                   ^  │       Space      │                   │
                   │  │                  │                   │
                   │  └──── Left/Right ──┘                   │
                   │       p/b (auto-pause)                  │
                   │                                         │
                   └──────────── r (restart) ─────────────────┘
```

**Key behaviors (confirmed in brainstorm/SpecFlow):**
- **Initial state:** Paused on first word. Status bar shows "Press Space to start"
- **Navigation while playing:** Left/Right/p/b auto-pause, then step. Space resumes
- **End of content:** Auto-pause on last word. Status bar shows completion stats: "Done — X words in Y:ZZ at avg N WPM. [r] restart [q] quit"
- **WPM range:** Clamped to 50–1500. Status bar shows "Min/Max speed" when hitting boundary
- **Restart (`r`):** Returns to initial paused state on first word. Keeps current WPM
- **Boundary behavior:** Left on first word → no-op. Right on last word → no-op. `p` on last paragraph → no-op. `b` on first paragraph → no-op

**`session.ts` — Track reading stats:**
```typescript
interface Session {
  startTime: number | null;    // When Space was first pressed
  totalReadingTime: number;    // Excludes paused time
  wordsRead: number;           // Words displayed while playing
  currentWpm: number;          // User's WPM setting
  averageWpm: number;          // Actual average based on time + words
}
```

### Phase 6: TUI Components (`src/ui/`)

**Ink configuration:**
```typescript
render(<App />, {
  exitOnCtrlC: true,
  maxFps: 60,
  incrementalRendering: true,
});
```

**`WordDisplay.tsx` — ORP-highlighted word rendering:**

ORP lookup table (from Spritz/OpenSpritz research):

| Word Length | ORP Index (0-based) |
|-------------|-------------------|
| 1           | 0                 |
| 2–5         | 1                 |
| 6–9         | 2                 |
| 10–13       | 3                 |
| 14+         | 4                 |

Display: fixed pivot column (center of screen). Pad left so ORP character always lands at the same position. ORP character rendered in **red + bold**. Rest of word in **bold white**.

Visual guide marker (`▼`) above the pivot column in dim color.

**`ProgressBar.tsx`:** Simple percentage bar. Progress = `currentWordIndex / totalWords`. Fill character: `█`, empty: `░`.

**`StatusBar.tsx`:** Single line at bottom:
```
  300 WPM  |  3:24 remaining  |  42%  |  ▶ Playing
```
States: "Press Space to start" | "▶ Playing" | "⏸ Paused" | "Done — X words in Y:ZZ"

**`HelpOverlay.tsx`:** Triggered by `?`. Pauses playback. Shows all keybindings. Dismissed by `?` or `Escape`. Playback stays paused after dismissal.

**Keybindings (MVP):**

| Key | Action |
|-----|--------|
| `Space` | Toggle pause/resume |
| `→` / `l` | Pause + advance one word |
| `←` / `h` | Pause + go back one word |
| `↑` / `k` | Increase WPM (+25) |
| `↓` / `j` | Decrease WPM (-25) |
| `p` | Pause + jump to next paragraph |
| `b` | Pause + jump to previous paragraph |
| `r` | Restart (paused on first word) |
| `q` | Quit (clean exit) |
| `?` | Toggle help overlay |

### Phase 7: Terminal Edge Cases

- **Ctrl+C:** Clean exit via Ink's `exitOnCtrlC`. Alternate screen buffer restored by CLI cleanup
- **Terminal resize:** Re-render on stdout `resize` events and re-center word display
- **Minimum terminal size:** 40 columns × 8 rows. If smaller, show "Terminal too small" and pause
- **`NO_COLOR` env var:** Respect it. Fall back to bold/underline for ORP highlighting
- **Exit codes:** 0 = normal exit (quit or finished), 1 = runtime error, 2 = usage error

## Testing Strategy: TDD Required

This is an open-source project — **every module must be built test-first using TDD** (Test-Driven Development). Use Bun's built-in test runner (`bun test`). No additional test framework needed.

### TDD Workflow

For each module, the implementation cycle is:

1. **Write the test first** — define the expected behavior via failing tests
2. **Run the test** — confirm it fails (red)
3. **Write the minimum code** to make the test pass (green)
4. **Refactor** — clean up while keeping tests green
5. **Repeat** — next behavior

**No production code without a corresponding test.** If a function exists in `src/`, it must have tests in `tests/`.

### Test Structure

```
tests/
├── processor/
│   ├── tokenizer.test.ts      # Tokenization, punctuation detection, edge cases
│   └── pacer.test.ts          # Timing calculations, multipliers, boundaries
├── engine/
│   ├── reader.test.ts         # State machine transitions, all state paths
│   └── session.test.ts        # Session stats tracking
├── ingest/
│   ├── plaintext.test.ts      # File reading, binary detection, encoding
│   └── detect.test.ts         # Input source detection logic
└── ui/
    └── orp.test.ts            # ORP index calculation (pure function)
```

### What to Test (by layer)

**Processor (pure functions — highest test value):**
- `tokenizer.ts`: Word splitting, paragraph detection, punctuation tier classification
  - "Hello, world." → 2 words, word 1 has `clause_break`, word 2 has `sentence_end`
  - Empty input → error
  - Whitespace-only → error
  - Hyphenated words stay as one token
  - Multiple consecutive blank lines collapse to one paragraph break
- `pacer.ts`: Display time calculations
  - 300 WPM base → ~200ms per plain word (with 0.9x multiplier)
  - Sentence-end words get 3x multiplier
  - Comma words get 2x multiplier
  - Longer words get sqrt-length penalty
  - First word minimum 200ms
  - Edge: 50 WPM, 1500 WPM boundary calculations

**Engine (state machine — critical for correctness):**
- `reader.ts`: Every state transition in the state diagram
  - `idle` → load → `paused` (on first word)
  - `paused` → Space → `playing`
  - `playing` → Space → `paused`
  - `playing` → Right → `paused` (auto-pause + step)
  - `playing` → last word → `finished`
  - `finished` → `r` → `paused` (restart)
  - Boundary: Left on first word → no-op, Right on last word → no-op
  - WPM adjustment: Up from 1500 → stays 1500, Down from 50 → stays 50
- `session.ts`: Time tracking, average WPM calculation

**Ingestion (I/O — test with fixtures):**
- `plaintext.ts`: Read file, file not found error, binary detection, empty file
- `detect.ts`: Piped stdin detection, file arg priority over stdin

**UI (ORP calculation only — the pure function part):**
- `WordDisplay.ts`: `getORPIndex()` lookup table correctness for all length ranges

### Test Fixtures

Create `tests/fixtures/` with sample files:
```
tests/fixtures/
├── sample.txt               # Normal multi-paragraph text (~200 words)
├── one-word.txt              # Single word: "Hello"
├── empty.txt                 # Empty file (0 bytes)
├── whitespace-only.txt       # Only spaces/newlines
├── punctuation-heavy.txt     # "Hello, world. How are you? Fine; thanks!"
├── long-words.txt            # "Supercalifragilisticexpialidocious understanding"
└── binary.bin                # A few bytes of binary data (null bytes)
```

### Running Tests

```bash
bun test                      # Run all tests
bun test --watch              # Watch mode during development
bun test tests/processor/     # Run processor tests only
```

### Implementation Order (TDD-driven)

Build modules in this order so each builds on tested foundations:

1. **`tokenizer.test.ts` → `tokenizer.ts`** — pure function, no dependencies
2. **`pacer.test.ts` → `pacer.ts`** — pure function, depends on Word type only
3. **`orp.test.ts` → ORP function** — pure function, no dependencies
4. **`plaintext.test.ts` → `plaintext.ts`** — I/O with fixtures
5. **`detect.test.ts` → `detect.ts`** — I/O detection logic
6. **`reader.test.ts` → `reader.ts`** — state machine, depends on tokenizer + pacer
7. **`session.test.ts` → `session.ts`** — depends on reader events
8. **UI components** — integrate tested modules into Ink components (manual testing for visual output)

### Acceptance Criteria for Testing

- [x] All modules in `src/processor/` and `src/engine/` have corresponding test files
- [x] `bun test` passes with 0 failures before any PR is merged
- [x] Test files are written BEFORE the implementation files (TDD)
- [x] Edge cases from SpecFlow analysis are covered (empty input, boundaries, binary files)
- [x] Test fixtures exist in `tests/fixtures/` for I/O tests

## Technical Considerations

- **Ink v6, not v5:** The original PLAN.md references `ink@^5`, but current is **v6.8.0**. Key v6 features used: `incrementalRendering` and `maxFps`
- **Fullscreen implementation:** Use manual alternate-screen handling (`\x1b[?1049h` / `\x1b[?1049l`) with Ink `render()` to avoid React version conflicts from wrapper packages
- **Bun stdin detection:** Use `fs.fstatSync(0)` to detect piped stdin (`isFIFO()` / `isFile()`) instead of relying on `process.stdin.isTTY`
- **Piped input + keyboard control:** For `cat file | rfaf`, read content from stdin, then switch interactive input to `/dev/tty` for keybindings
- **setTimeout chains, not setInterval:** Each word has a different display duration (punctuation, length). Use `setTimeout` per word, not a fixed interval
- **React 19 required:** Ink 6 uses React 19 in this setup; keep `react` and `@types/react` aligned
- **No build step for dev:** Bun natively handles TypeScript + JSX. Just `bun run src/cli/index.tsx`

## Acceptance Criteria

### CLI & Input
- [x] `rfaf myfile.txt` opens the file and starts in paused state on the first word
- [x] `cat text.txt | rfaf` reads piped stdin and starts in paused state
- [x] `rfaf --wpm 400` sets initial speed to 400 WPM
- [x] `rfaf --wpm 0` shows validation error and exits with code 2
- [x] `rfaf nonexistent.txt` shows "File not found" error and exits with code 1
- [x] `rfaf empty.txt` (empty/whitespace-only file) shows "File is empty" error
- [x] `rfaf image.png` (binary file) shows "Binary file detected" error
- [x] `rfaf` with no args and no pipe shows help text
- [x] `echo "hi" | rfaf myfile.txt` reads file, warns about ignored stdin to stderr

### RSVP Display
- [x] Words display one at a time, centered on screen
- [x] ORP character highlighted in red+bold at a fixed column position
- [x] ORP position follows the lookup table (1-char→0, 2-5→1, 6-9→2, 10-13→3, 14+→4)
- [x] Progress bar shows current position as percentage
- [x] Status bar shows: WPM, time remaining, progress %, play/pause state

### Timing & Pacing
- [x] At 300 WPM, a 100-word file with no punctuation completes in ~18-22 seconds
- [x] Words ending with `.` `!` `?` display 3x longer than plain words
- [x] Words ending with `,` `;` `:` display 2x longer
- [x] Paragraph breaks add a 4x base-time pause
- [x] Longer words display slightly longer (sqrt-length penalty)
- [x] First word displays for at least 200ms regardless of WPM

### Controls
- [x] Space toggles pause/resume
- [x] Up/k increases WPM by 25; Down/j decreases by 25
- [x] WPM clamps at 50 (min) and 1500 (max)
- [x] Right/l while playing: pauses then advances one word
- [x] Left/h while playing: pauses then goes back one word
- [x] `p` jumps to next paragraph start (pauses if playing)
- [x] `b` jumps to previous paragraph start (pauses if playing)
- [x] `r` restarts: returns to first word, paused, keeps current WPM
- [x] `q` quits cleanly, restores terminal
- [x] `?` toggles help overlay, pauses playback
- [x] Boundary navigation is a no-op (left on first word, right on last, etc.)

### End of Content
- [x] Auto-pauses on last word
- [x] Status bar shows completion stats: words read, total time, average WPM
- [x] `r` restarts, `q` quits from finished state

### Terminal
- [x] Ctrl+C cleanly exits and restores terminal
- [x] Terminal resize re-renders correctly
- [x] Respects `NO_COLOR` env var (falls back to bold/underline)
- [x] Exit code 0 on normal quit, 1 on error, 2 on usage error

### Remaining Manual Validation

No remaining manual validation items.

## Success Metrics

- **Functional:** All acceptance criteria pass
- **Testing:** `bun test` passes with 0 failures. All processor and engine modules have tests written before implementation (TDD)
- **Performance:** No visible flicker at 500 WPM. Startup time < 200ms
- **Usability:** A developer can `git clone`, `bun install`, and `bun run src/cli/index.tsx sample.txt` within 60 seconds
- **Scope:** Zero LLM dependencies, zero config file, single reading mode (RSVP only)

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Ink flicker at high WPM | Low | High | Phase 0 spike validates. Fallback: raw ANSI |
| TTY/input stream incompatibility | Medium | Medium | Use `/dev/tty` for interactive key input after stdin ingest; fail with clear message if no interactive TTY |
| yargs overhead in Bun | Very Low | Low | yargs is well-tested. No known Bun issues |
| ORP algorithm feels wrong | Medium | Medium | Based on proven Spritz lookup table. Tunable after user testing |
| Timing model feels unnatural | Medium | Medium | Based on `speedread` (proven). Multipliers are configurable constants |

**No external service dependencies.** MVP is fully local — no network calls, no API keys, no config file.

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md](../brainstorms/2026-03-04-rfaf-mvp-scope-brainstorm.md) — Key decisions carried forward: plaintext+stdin only, deep RSVP only, Ink validation spike, word-length aware pausing, revised phase order

### Internal References

- Original full-scope plan: `PLAN.md` (covers all 5 phases)

### External References

- **ORP algorithm:** OpenSpritz by Rich Jones (`spritz.js` pivot function) — word-length lookup table
- **Timing model:** `speedread` by Petr Baudis (Perl) — punctuation multipliers, sqrt-length penalty
- **Ink 6 docs:** `maxFps`, `incrementalRendering`, `useInput` hook, synchronized output
- **Manual alternate-screen pattern:** ANSI `\x1b[?1049h` / `\x1b[?1049l` around Ink lifecycle
- **Bun file API:** `Bun.file()`, `Bun.stdin.text()`, `process.stdin.isTTY`
