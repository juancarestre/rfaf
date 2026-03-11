# Field Notes: Reader Behavior Dataset

## Session Metadata

- observer: internal research team
- scope: long-form reading behavior under varying pacing
- objective: capture repeatable evidence without collapsing detail

## Timeline

1. Baseline capture begins with neutral prose and no cognitive prompts.
2. Participants receive pacing instructions with explicit pause windows.
3. Follow-up captures add denser paragraphs and alternating sentence lengths.
4. Debrief asks for comprehension checkpoints and confidence ratings.

## Observations

During baseline runs, readers maintain stable cadence until paragraph transitions become frequent.
When transitions occur every two or three lines, users overshoot context boundaries and backtrack.
Backtracking increases when punctuation density rises, especially where commas and semicolons cluster.
Comprehension remains high, but self-reported effort rises steadily in the final third of each passage.

In paced runs, explicit pause windows reduce overshoot but increase perceived interruption.
Some participants prefer fewer pauses with larger chunks, while others prefer many short pauses.
A hybrid strategy appears promising: short pauses at paragraph starts and longer pauses after dense passages.
This strategy preserves continuity while providing enough recovery time for sentence integration.

## Risk Register

- risk: aggressive cleaning may remove low-frequency but critical qualifiers.
- risk: partial outputs can appear fluent while silently dropping chronology.
- mitigation: enforce content-preservation checks with deterministic typed failures.
- mitigation: validate large fixtures that include headings, lists, and paragraph-rich narrative.

## Verification Notes

To verify preservation, compare token overlap, numeric references, and paragraph continuity.
Token overlap alone is insufficient when structural collapse hides omitted context.
Numeric references help detect fabricated values but do not prove narrative completeness.
Paragraph continuity checks are necessary for long inputs where one-paragraph outputs can mask loss.

## Closing

This fixture intentionally mixes headings, lists, and dense prose to simulate structured source text.
It is designed for fail-closed contract tests where no-bs output must remain complete or fail explicitly.
