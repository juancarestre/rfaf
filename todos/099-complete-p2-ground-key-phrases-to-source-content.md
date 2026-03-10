---
status: complete
priority: p2
issue_id: "099"
tags: [code-review, security, llm, contracts]
dependencies: []
---

# Enforce Source-Grounded Key Phrase Contract

Add fail-closed validation so extracted key phrases are grounded in source content.

## Problem Statement

Prompt constraints alone cannot guarantee that key phrases are copied/grounded in source text. Prompt injection within source content can produce arbitrary phrases that violate deterministic contracts.

## Findings

- `src/llm/key-phrases.ts:148` builds prompt constraints but currently accepts any schema-valid phrase text.
- Security review flagged lack of grounding checks against input text spans.
- This weakens trust and can lead to misleading or unsafe phrase output.

## Proposed Solutions

### Option 1: Strict Span Validation

**Approach:** Normalize source text and accept only phrases that match known n-gram spans from source.

**Pros:**
- Strong fail-closed contract
- Deterministic and testable

**Cons:**
- May reject useful lightly-normalized phrases

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Hybrid Validation (Span + Relaxed Normalization)

**Approach:** Allow punctuation/case/whitespace normalization while still requiring phrase token overlap above strict threshold.

**Pros:**
- Better usability with still-strong grounding

**Cons:**
- More nuanced and harder to calibrate

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `src/llm/key-phrases.ts`
- `tests/llm/key-phrases.test.ts`

**Related components:**
- LLM contract validation
- Key phrase normalization and dedupe

**Database changes:**
- No

## Resources

- `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`

## Acceptance Criteria

- [ ] Non-grounded phrases are rejected with fail-closed schema/runtime error
- [ ] Grounded phrases with punctuation/case variance still pass
- [ ] Test fixtures cover prompt injection attempt in source text

## Work Log

### 2026-03-10 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Captured prompt-injection/grounding gap from security review
- Mapped to existing fail-closed validation patterns in repo learnings

**Learnings:**
- Prompt instructions must be paired with runtime validation for deterministic contracts.

### 2026-03-10 - Resolution

**By:** Claude Code

**Actions:**
- Added source-grounding validation in `src/llm/key-phrases.ts` to fail closed when extracted phrases do not exist in normalized source token spans
- Preserved deterministic schema-stage failure semantics for non-grounded phrase sets
- Added focused regression test in `tests/llm/key-phrases.test.ts`

**Learnings:**
- Grounding checks are a practical, deterministic guardrail against prompt-injected phrase drift.

## Notes

- Keep validation deterministic and provider-agnostic.
