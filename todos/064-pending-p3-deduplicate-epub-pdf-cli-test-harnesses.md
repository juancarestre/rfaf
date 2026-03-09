---
status: pending
priority: p3
issue_id: "064"
tags: [code-review, quality, tests, maintainability]
dependencies: []
---

# Deduplicate PDF and EPUB CLI/PTY Contract Test Harnesses

Reduce duplicate test helper code between PDF and EPUB contract suites.

## Problem Statement

EPUB CLI and PTY contract tests duplicate nearly identical helper code from PDF tests, increasing maintenance burden and drift risk for future harness changes.

## Findings

- `tests/cli/epub-cli-contract.test.ts` mirrors helper logic in `tests/cli/pdf-cli-contract.test.ts`.
- `tests/cli/epub-pty-contract.test.ts` mirrors PTY python harness in `tests/cli/pdf-pty-contract.test.ts`.
- Simplicity review flagged this as avoidable duplication.

## Proposed Solutions

### Option 1: Shared Test Utilities (Recommended)

**Approach:** Move common spawn/pty helpers into shared test utility modules and keep per-format assertions in slim test files.

**Pros:**
- Lower maintenance cost
- Easier to evolve harness behavior consistently

**Cons:**
- Minor refactor across multiple tests

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep Duplicates

**Approach:** No refactor.

**Pros:**
- No immediate change cost

**Cons:**
- Ongoing duplication and drift risk

**Effort:** None

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `tests/cli/pdf-cli-contract.test.ts`
- `tests/cli/epub-cli-contract.test.ts`
- `tests/cli/pdf-pty-contract.test.ts`
- `tests/cli/epub-pty-contract.test.ts`

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-17-epub-ingestion`

## Acceptance Criteria

- [ ] Shared helper utilities replace duplicated spawn/PTY harness code
- [ ] PDF and EPUB contract tests retain current behavior
- [ ] Full tests pass with no regression in contract semantics

## Work Log

### 2026-03-09 - Initial Discovery

**By:** OpenCode

**Actions:**
- Identified duplicated helper blocks across PDF/EPUB contract tests.
- Scoped low-risk utility extraction approach.

**Learnings:**
- Contract tests benefit from shared harnesses as source count grows.
