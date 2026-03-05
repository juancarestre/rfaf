---
status: complete
priority: p2
issue_id: 003
tags: [code-review, performance, security, ingestion]
dependencies: []
---

# Problem Statement

The app fully buffers input content, which can cause excessive memory usage or OOM on large files/streams.

## Findings

- Full file bytes loaded in `src/ingest/plaintext.ts:25`.
- Full stdin buffered in `src/ingest/stdin.ts:10`.
- Tokenizer performs additional full-pass splits in `src/processor/tokenizer.ts:48`.

## Proposed Solutions

### Option 1: Enforce a maximum input size
Pros: Fastest mitigation; predictable memory ceiling.  
Cons: Large-document use cases need explicit override strategy.  
Effort: Small  
Risk: Low

### Option 2: Stream and tokenize incrementally
Pros: Best scalability and memory profile.  
Cons: Larger refactor; changes processor/engine assumptions.  
Effort: Large  
Risk: Medium

### Option 3: Hybrid (size cap now, streaming roadmap)
Pros: Immediate risk reduction with future-proof path.  
Cons: Two-phase implementation.  
Effort: Medium  
Risk: Low

## Recommended Action

Option 3.

## Technical Details

- Introduce input byte limit constant in ingest layer.
- Return clear error when limit exceeded.
- Track a follow-up task for streaming tokenizer.

## Acceptance Criteria

- [ ] Very large inputs fail fast with clear error.
- [ ] Existing normal-size files/streams work unchanged.
- [ ] Automated tests cover size-limit boundary behavior.

## Work Log

- 2026-03-05: Created from security/performance findings.
- 2026-03-05: Added max input-size guards via `src/ingest/constants.ts` and wired them into file/stdin ingestion.
- 2026-03-05: Added limit-focused tests in `tests/ingest/plaintext.test.ts` and `tests/ingest/stdin.test.ts`.

## Resources

- Related: `docs/institutional-learnings-analysis.md` (Known Pattern: stdin/tty handling quality is good; ingestion limits remain open).
