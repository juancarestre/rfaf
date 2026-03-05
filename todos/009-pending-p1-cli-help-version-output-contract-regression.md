---
status: complete
priority: p1
issue_id: 009
tags: [code-review, quality, cli, reliability]
dependencies: []
---

# Problem Statement

`--help` and `--version` behavior regressed after adding text-scale parsing: outputs are duplicated and/or include unexpected help text.

## Findings

- `src/cli/index.tsx:123` sets `.exitProcess(false)` globally.
- `src/cli/index.tsx:143` + `src/cli/index.tsx:144` call `parser.showHelp()` again when no input source is resolved.
- `bun run src/cli/index.tsx --help` currently prints help twice.
- `bun run src/cli/index.tsx --version` currently prints version and then help text.

## Proposed Solutions

### Option 1: Early-return on `argv.help`/`argv.version`
Pros: Restores deterministic meta-flag behavior with minimal code change.  
Cons: Requires explicit guards before input-source resolution.  
Effort: Small  
Risk: Low

### Option 2: Remove `.exitProcess(false)` and rely on yargs default for meta flags
Pros: Aligns with common yargs behavior.  
Cons: May affect existing test harness/error trapping strategy.  
Effort: Small  
Risk: Medium

### Option 3: Keep `.exitProcess(false)` but branch parser flow with dedicated output handlers
Pros: Full explicit control over every CLI branch.  
Cons: More code paths and maintenance overhead.  
Effort: Medium  
Risk: Medium

## Recommended Action


## Technical Details

- Affected: `src/cli/index.tsx`
- Impact area: CLI contract, exit behavior, stdout/stderr expectations.

## Acceptance Criteria

- [ ] `rfaf --help` prints help exactly once and exits successfully.
- [ ] `rfaf --version` prints only version output and exits successfully.
- [ ] `rfaf --help --text-scale huge` still reports validation failure with usage error exit.
- [ ] CLI contract tests cover meta-flag behavior without regressions.

## Work Log

- 2026-03-05: Created from multi-agent review synthesis.
- 2026-03-05: Fixed by short-circuiting after validated arg parsing when `--help` or `--version` is present; added CLI contract tests for single help output and clean version output.

## Resources

- Review context: `compound-engineering.local.md`
