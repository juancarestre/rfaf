---
status: pending
priority: p2
issue_id: "123"
tags: [code-review, quality, unicode]
dependencies: []
---

# Make Chunk Splitting Unicode Safe

Prevent chunk boundary slicing from splitting surrogate pairs and corrupting non-BMP characters.

## Problem Statement

Chunk slicing decrements UTF-16 code-unit boundaries while checking byte limits. This can split a surrogate pair and emit malformed text fragments.

## Findings

- `src/llm/long-input-chunking.ts:60-73` slices long words by code-unit indexes.
- `src/llm/long-input-chunking.ts:92-103` uses similar code-unit slicing fallback for segments.
- Byte checks are UTF-8, but boundary iteration is UTF-16 code-unit based.

## Proposed Solutions

### Option 1: Code Point Aware Boundary Walk

**Approach:** Iterate grapheme/code point safe offsets when reducing end boundary.

**Pros:**
- Eliminates surrogate-splitting corruption
- Maintains existing behavior model

**Cons:**
- Slight implementation complexity

**Effort:** 3-4 hours

**Risk:** Low

---

### Option 2: Pre-tokenize into Unicode-safe units

**Approach:** Split oversized tokens into code-point arrays first, then pack by bytes.

**Pros:**
- Simplifies safety reasoning

**Cons:**
- Higher memory overhead on huge tokens

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/llm/long-input-chunking.ts`
- `tests/llm/long-input-chunking-contract.test.ts`

## Acceptance Criteria

- [ ] Chunking never splits surrogate pairs.
- [ ] Emoji/non-BMP fixtures remain round-trippable after split+merge.
- [ ] Existing deterministic ordering/size tests still pass.

## Work Log

### 2026-03-11 - Review Finding Created

**By:** OpenCode

**Actions:**
- Recorded Unicode boundary safety issue from reviewer evidence.

**Learnings:**
- UTF-8 byte budgets must not be enforced with unsafe UTF-16 boundary logic.
