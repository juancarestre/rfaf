---
status: complete
priority: p2
issue_id: "097"
tags: [code-review, performance, pipeline, cli]
dependencies: []
---

# Skip Tokenization for Quiz-Only Flow

Quiz-only execution currently does unnecessary tokenization and mode transforms.

## Problem Statement

When `--quiz` is enabled, the CLI still runs the full reading pipeline tokenization and mode transformations even though quiz flow only needs transformed text and source label.

## Findings

- `buildReadingPipeline` always tokenizes and may transform words in `src/cli/reading-pipeline.ts:127`.
- `--quiz` path branches after pipeline completion in `src/cli/index.tsx:433`.
- Performance review identified avoidable CPU/memory overhead for quiz-only runs.
- Known pattern: keep MVP flow tight and avoid unnecessary work (`compound-engineering.local.md:10`).

## Proposed Solutions

### Option 1: Add content-only pipeline entrypoint

**Approach:** Extract no-bs/summary/translate content transforms into a content-only function; keep tokenization in reading-specific path.

**Pros:**
- Eliminates unnecessary work in quiz mode
- Keeps responsibilities explicit

**Cons:**
- Introduces one additional pipeline function

**Effort:** Medium (1-3 hours)

**Risk:** Low

---

### Option 2: Add pipeline flag to skip tokenize/transform

**Approach:** Add `skipTokenization` option in `buildReadingPipeline` and bypass word transforms for quiz mode.

**Pros:**
- Smaller API expansion

**Cons:**
- Increases conditional complexity in core pipeline

**Effort:** Small-Medium (1-2 hours)

**Risk:** Medium

## Recommended Action

Implemented Option 1 by splitting pre-read transforms into a content-only pipeline function used by quiz mode, while preserving tokenization/mode transforms for reading mode only.

## Technical Details

**Affected files:**
- `src/cli/index.tsx:396`
- `src/cli/reading-pipeline.ts:47`
- `src/cli/quiz-flow.ts:40`

**Related components:**
- pre-read transform chain (`no-bs -> summary -> translate`)

**Database changes (if any):**
- None

## Resources

- **Review signal:** performance-oracle findings for current branch review
- **Context:** `compound-engineering.local.md`

## Acceptance Criteria

- [x] `--quiz` skips tokenization/mode transform work
- [x] Reading mode behavior remains unchanged when `--quiz` is off
- [x] Existing ordering contracts for no-bs/summary/translate remain intact
- [x] Full test suite passes

## Work Log

### 2026-03-10 - Initial Review Finding

**By:** Claude Code

**Actions:**
- Traced quiz path from CLI into reading pipeline
- Confirmed avoidable tokenization and transforms before quiz branch

**Learnings:**
- Quiz and reading flows share transform prerequisites but not tokenization needs

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added `buildTransformedContentPipeline` in `src/cli/reading-pipeline.ts`
- Updated `src/cli/index.tsx` to route quiz through content-only transforms
- Added ordering and no-op tests in `tests/cli/quiz-content-pipeline.test.ts`

**Learnings:**
- Separating transform-only and tokenize+render paths keeps responsibilities clear and improves quiz-mode efficiency

## Notes

- This is a performance optimization; current behavior is functionally correct.
