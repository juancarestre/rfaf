---
module: Development Workflow
date: 2026-03-10
problem_type: workflow_issue
component: development_workflow
symptoms:
  - "Git merge could not auto-resolve parallel feature branches and reported conflicts in shared integration files."
  - "Concurrent edits in src/cli/index.tsx caused option wiring drift risk across --quiz, --strategy, and --key-phrases."
  - "Shared runtime error taxonomy in src/cli/errors.ts diverged between branches."
  - "Pipeline and agent orchestration files required manual reconciliation to preserve all features."
  - "Without reconciliation, CLI/agent parity and deterministic contracts would regress."
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [merge-conflict, branch-integration, cli-agent-parity, contract-validation, workflow-hardening]
---

# Troubleshooting: Parallel Branch Reconciliation With Contract Validation

## Problem
Two pushed feature branches (`phase-5 subphase-23` quiz and `phase-5 subphase-24` strategy) were merged into `main` after key-phrases had already landed, and all three changed shared integration files. Git could not auto-merge safely, and a naive conflict choice would have dropped features or broken deterministic contracts.

## Environment
- Module: Development Workflow
- Affected Component: CLI + agent integration surfaces
- Date: 2026-03-10
- Branches integrated: `origin/feat/phase-5-subphase-23`, `origin/feat/phase-5-subphase-24`

## Symptoms
- Merge conflict markers appeared in `src/cli/errors.ts`, `src/cli/index.tsx`, `src/cli/reading-pipeline.ts`, and `src/agent/reader-api.ts`.
- `src/cli/index.tsx` had overlapping control flow for standalone quiz, strategy advisory mode selection, and key-phrases preview/list behavior.
- `src/cli/errors.ts` had competing additions of feature-specific runtime error classes.
- `src/cli/reading-pipeline.ts` diverged between full reading and transformed-content-only paths.
- Agent command surface risked drift from CLI behavior after strategy + key-phrases additions.

## What Didn't Work

**Attempted Solution 1:** Rely on automatic merge only.
- **Why it failed:** Shared integration files had structural conflicts, not trivial line-order conflicts.

**Attempted Solution 2:** Use one-side conflict resolution (`ours`/`theirs`) for conflicted files.
- **Why it failed:** This would silently remove valid behavior from one branch (quiz or strategy or key-phrases).

## Solution

Resolve merges in sequence and reconcile shared contracts explicitly.

**Step-by-step fix:**
```bash
# 1) Merge subphase-23 and resolve conflicts in CLI entry/errors/pipeline
git merge origin/feat/phase-5-subphase-23

# 2) Validate merged behavior
bun test tests/cli tests/llm/quiz.test.ts tests/llm/key-phrases.test.ts tests/agent/reader-api.test.ts

# 3) Commit merge resolution
git add .
git commit -m "merge: integrate phase-5 subphase-23 quiz"

# 4) Merge subphase-24 and resolve conflicts in CLI entry/errors/agent runtime
git merge origin/feat/phase-5-subphase-24

# 5) Validate merged behavior
bun test tests/cli tests/agent tests/llm/strategy.test.ts

# 6) Final project validation
bun test
bun x tsc --noEmit
```

**Code-level reconciliation highlights:**
```ts
// src/cli/index.tsx (resolved union)
validateNoBsArgs(rawArgs);
validateQuizArgs(rawArgs);
validateStrategyArgs(rawArgs);

const normalizedArgs = normalizeKeyPhrasesArgs(
  normalizeTranslateArgs(normalizeSummaryArgs(rawArgs))
);

// keep all options: --quiz, --strategy, --key-phrases
// keep quiz early-return flow, then strategy advisory mode resolution for reading flow
```

```ts
// src/cli/errors.ts (resolved union)
export class KeyPhrasesRuntimeError extends Error { /* ... */ }
export class QuizRuntimeError extends Error { /* ... */ }
export class StrategyRuntimeError extends Error { /* ... */ }
```

## Why This Works
The fix preserves the union of intended behavior from all parallel features while reasserting deterministic contracts at shared integration seams. By reconciling validation order, parser normalization, runtime error taxonomy, and CLI/agent entrypoint behavior, the merged system maintains fail-closed semantics and parity instead of whichever branch happened to "win" a conflict. Targeted tests plus full-suite validation then prove the merged behavior is coherent.

## Prevention
- Use an integration branch when two or more feature branches touch `src/cli/index.tsx` or `src/cli/errors.ts`.
- Treat these files as merge hotspots and require explicit reconciliation review (not one-side conflict picks).
- Require contract tests for every new flag path and help output update before merge.
- Run targeted suites for touched features before full suite to catch drift faster.
- Keep feature internals modular (`*-flow.ts`, `*-option.ts`) and minimize entrypoint edits per branch.

## Related Issues
- See also: `docs/solutions/logic-errors/cli-summary-parsing-nondeterminism-parity-hardening-20260305.md`
- See also: `docs/solutions/integration-issues/translate-no-bs-contract-hardening-cli-agent-parity-20260309.md`
- See also: `docs/solutions/integration-issues/summary-language-preservation-hardening-retry-contracts-cli-agent-tests-20260309.md`
- See also: `docs/solutions/logic-errors/runtime-mode-switching-hardening-cli-runtime-20260307.md`
- See also: `docs/solutions/integration-issues/url-ingestion-cli-agent-parity-deterministic-errors-spinner.md`
