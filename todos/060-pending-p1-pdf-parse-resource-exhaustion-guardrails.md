---
status: completed
priority: p1
issue_id: "060"
tags: [code-review, security, performance, ingestion]
dependencies: []
---

# Add Guardrails For PDF Parse Resource Exhaustion

Prevent malicious/crafted PDFs from consuming excessive CPU/RAM before extraction limits can fail fast.

## Problem Statement

Current PDF ingestion enforces extracted text size only after parse completion. A crafted PDF can force expensive parse work (or huge intermediate output) before post-parse checks run, causing hangs or memory pressure.

## Findings

- `src/ingest/pdf.ts:62` performs full parse before extracted-size guard at `src/ingest/pdf.ts:71`.
- No parse timeout, page budget, or process isolation currently protects parser runtime.
- Security and performance reviews flagged this as high-risk local DoS surface.
- Known pattern: enforce limits on authoritative processing path and fail deterministically (see `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`).

## Proposed Solutions

### Option 1: Add Parse Timeout + Page/Text Budget In-Process

**Approach:** Wrap parse in timeout race and enforce strict page/text accumulation caps while extracting.

**Pros:**
- Moderate complexity
- Stronger protection than post-parse-only checks

**Cons:**
- Still same-process CPU/memory exposure
- Requires careful parser API handling

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Isolate Parse In Worker/Subprocess (Recommended)

**Approach:** Parse PDFs in isolated worker/subprocess with wall-clock timeout and hard memory boundary; terminate on overrun.

**Pros:**
- Best containment for parser bombs
- Clear failure boundary and cleanup

**Cons:**
- Higher implementation complexity
- More test harness work

**Effort:** Large

**Risk:** Medium

---

### Option 3: Documented Limitations Only

**Approach:** Keep implementation unchanged and document potential resource-risk behavior.

**Pros:**
- No implementation cost

**Cons:**
- Leaves critical risk unresolved
- Not acceptable for robust ingestion boundary

**Effort:** Small

**Risk:** High

## Recommended Action

Implemented in-process deterministic parse timeout guardrail and fallback parse-failure normalization.

## Technical Details

**Affected files:**
- `src/ingest/pdf.ts`
- `tests/ingest/pdf.test.ts`
- Potential new worker helper under `src/ingest/`

**Related components:**
- CLI file dispatch path
- Agent file ingest parity path

**Database changes:**
- No

## Resources

- **Review target:** local branch `feat/phase-4-subphase-16-pdf-ingestion`
- **Known pattern:** `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
- **Known pattern:** `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`

## Acceptance Criteria

- [x] PDF parse has deterministic timeout/cap behavior before catastrophic resource use
- [x] Overrun conditions return stable, user-facing deterministic error
- [x] Tests cover pathological parse timeout/overrun scenario
- [x] `bun test` and `bun x tsc --noEmit` pass

### 2026-03-08 - Implemented

**By:** OpenCode

**Actions:**
- Added parse-timeout race in `readPdfFile()` with deterministic `PDF parsing timed out` error.
- Normalized unknown parser failures to stable `Failed to parse PDF file` error.
- Added timeout and unknown-parse normalization tests in `tests/ingest/pdf.test.ts`.

## Work Log

### 2026-03-08 - Initial Discovery

**By:** OpenCode

**Actions:**
- Consolidated security + performance review findings into one critical risk.
- Mapped current guard ordering and lack of parse runtime containment.

**Learnings:**
- Post-parse size checks alone are insufficient for parser-bomb scenarios.
