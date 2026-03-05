# RSVP MVP PTY Acceptance Validation

Date: 2026-03-05

## Scope

Validated the previously unchecked interactive acceptance criteria from:

`docs/plans/2026-03-04-feat-rsvp-speed-reading-mvp-plan.md`

## Method

- Used a Python PTY harness to run `rfaf` inside a pseudo-terminal.
- Simulated key input (`Space`, `?`, `r`, `q`, `Ctrl+C`) and window resize events.
- Captured ANSI output and asserted expected status text and behavior.

## Results

All targeted checks passed:

1. File input starts paused on first word.
2. Piped stdin starts paused with `source=stdin`.
3. Word lane appears centered and ORP pivot column remains fixed.
4. ORP pivot renders with bold + red styling.
5. `?` shows help overlay and pauses playback.
6. Completion status shows words/time/avg WPM.
7. Restart from finished returns to paused start state.
8. `q` quits cleanly from normal and finished states.
9. `Ctrl+C` exits cleanly.
10. Terminal resize triggers re-render and small-terminal guard message.
11. Alternate screen enter/exit sequences are emitted and restored on quit.

## Notes

- Added `RFAF_NO_ALT_SCREEN=1` test mode to make PTY output assertions stable.
- Kept default production behavior with alternate-screen enabled.

## Phase 1.2 Text Scale Extension

Validated additional PTY smoke checks for Phase 1.2 text readability presets:

1. `--text-scale small` starts in paused state without startup errors.
2. `--text-scale normal` starts in paused state without startup errors.
3. `--text-scale large` starts in paused state without startup errors.
4. With `--text-scale large`, resizing to constrained dimensions still triggers the existing "Terminal too small" guard.

These checks were executed with the same PTY harness pattern and `RFAF_NO_ALT_SCREEN=1` for stable output capture.

## Phase 2 Summarize Extension

Validated summarize startup/failure loading behavior via automated terminal smoke checks:

1. `--summary` defaults to `medium` when passed without explicit preset (covered by CLI arg tests).
2. Missing config in summarize mode returns a clear usage/config error (exit `2`) and does not start RSVP.
3. Runtime summarize failure returns non-zero (exit `1`) and does not start RSVP.
4. Non-TTY loading output remains deterministic (no broken spinner artifacts):
   - emits `Summarizing: ...` while request is active
   - emits `[error] summarization failed` on failure

Smoke command used for timeout failure path:

```bash
python3 -c "import os,pty,subprocess,tempfile,textwrap; d=tempfile.mkdtemp(prefix='rfaf-phase2-'); os.makedirs(os.path.join(d,'.rfaf'),exist_ok=True); open(os.path.join(d,'.rfaf','config.toml'),'w').write(textwrap.dedent('''[llm]\nprovider = \"openai\"\nmodel = \"gpt-4o-mini\"\n\n[summary]\ntimeout_ms = 1\nmax_retries = 0\n''')); env=dict(os.environ); env['HOME']=d; env['OPENAI_API_KEY']='dummy'; env['RFAF_NO_ALT_SCREEN']='1'; proc=subprocess.Popen(['bun','run','src/cli/index.tsx','--summary','tests/fixtures/sample.txt'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,text=True); out,err=proc.communicate(timeout=20); print('exit',proc.returncode); print(err)"
```

## Phase 3 Sub-phase 11 Chunked Mode Extension

Validated chunked-mode behavior and summary compatibility checks:

1. `--mode` accepts `rsvp|chunked` and rejects unsupported values with usage-style error (exit `2`).
2. Chunking emits deterministic adaptive groups with no dropped/duplicated words.
3. Chunk pacing remains WPM-compatible by deriving chunk dwell from source word timing.
4. Summary compatibility order is enforced: summarize -> tokenize -> chunk transform.
5. Summary failure in `--mode chunked` path prevents playback start and exits non-zero.
6. Chunk display remains vertically centered with existing reading-lane layout contract.

Smoke command used for summary+chunked runtime failure path:

```bash
python3 -c "import os,subprocess,tempfile,textwrap; d=tempfile.mkdtemp(prefix='rfaf-chunked-summary-'); os.makedirs(os.path.join(d,'.rfaf'),exist_ok=True); open(os.path.join(d,'.rfaf','config.toml'),'w').write(textwrap.dedent('''[llm]\nprovider = \"openai\"\nmodel = \"gpt-4o-mini\"\n\n[summary]\ntimeout_ms = 1\nmax_retries = 0\n''')); env=dict(os.environ); env['HOME']=d; env['OPENAI_API_KEY']='dummy'; env['RFAF_NO_ALT_SCREEN']='1'; proc=subprocess.Popen(['bun','run','src/cli/index.tsx','--summary','--mode','chunked','tests/fixtures/sample.txt'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,text=True); out,err=proc.communicate(timeout=20); print('exit',proc.returncode); print(err)"
```
