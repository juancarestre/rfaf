---
module: Guided Scroll Mode
date: 2026-03-06
problem_type: ui_bug
component: tooling
symptoms:
  - "Guided scroll inserted unnecessary orphan line breaks in terminal output"
  - "Rendered line boundaries drifted from the visible text when tokens contained terminal control sequences"
  - "Current-line highlight and line-step navigation could target a different line than the user saw"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [guided-scroll, terminal-rendering, line-wrapping, sanitization, ink, line-map]
---

# Troubleshooting: Guided Scroll Line Break And Highlight Drift

## Problem

Guided scroll mode wrapped lines using a different width contract than the one Ink actually rendered. This produced unnecessary orphan line breaks and could desynchronize the highlighted line and line-step behavior from the text visible in the terminal.

## Environment

- Module: Guided Scroll Mode
- Affected Component: Ink terminal UI wrapping and line-map computation
- Date: 2026-03-06

## Symptoms

- Long paragraphs in guided scroll showed stray single-word line breaks such as `fundamental`, `de`, or `posicion` on their own line.
- The first fix removed some orphan wrapping, but hostile terminal text (ANSI/OSC/CR payloads) could still produce line boundaries that did not match the rendered text.
- The current-line highlight and line-step navigation were derived from the line map, so any width mismatch also risked stepping/highlighting the wrong visible line.

## What Didn't Work

**Attempted Solution 1:** Compute line wrapping from the full terminal width.
- **Why it failed:** The guided scroll text renders inside a padded container (`paddingX={1}`), so usable content width is narrower than raw terminal width.

**Attempted Solution 2:** Fix only the padding mismatch by subtracting horizontal padding from the width.
- **Why it failed:** It solved ordinary orphan wrapping, but line measurement still used raw `word.text.length` while rendering stripped terminal control sequences. Wrapping and rendering could still disagree.

## Solution

Make line wrapping use the same display contract as rendering:

1. Compute line wrapping from content width, not raw terminal width.
2. Measure words using sanitized display text, not raw token text.
3. Reuse pre-sanitized word text when building visible line strings.

**Code changes**:

```ts
// Before: used full terminal width
const lineMap = useMemo(() => computeLineMap(words, width), [words, width]);

// After: account for the text container's horizontal padding
const textPaddingX = 1;
const contentWidth = Math.max(1, width - textPaddingX * 2);
const lineMap = useMemo(
  () => computeLineMap(words, contentWidth),
  [words, contentWidth]
);
```

```ts
// Before: wrapping measured raw token width
const wordLen = words[i]!.text.length;

// After: wrapping measures the same sanitized representation that is rendered
function getDisplayWordWidth(word: Word): number {
  return sanitizeTerminalText(word.text).length;
}

const wordLen = getDisplayWordWidth(words[i]!);
```

```ts
// After: sanitize once and reuse the same display text for visible line strings
const sanitizedWords = useMemo(
  () => words.map((word) => sanitizeTerminalText(word.text)),
  [words]
);
```

**Commands run**:

```bash
bun test tests/processor/line-computation.test.ts
bun test tests/cli/scroll-pty-contract.test.ts
bun test
bun x tsc --noEmit
```

## Why This Works

The root cause was not "wrapping is hard" in general - it was a parity bug between measurement and rendering.

1. The renderer displayed text inside a padded box, but the line map originally used the full terminal width. That meant some lines were considered valid by the layout algorithm even though Ink had fewer visible columns available.
2. Rendering also sanitizes terminal text before display. When wrapping logic measured raw strings but the UI rendered sanitized strings, both sides were working from different byte/character shapes.
3. Once both wrapping and rendering use the same normalized display representation and the same usable content width, line boundaries become deterministic again. That keeps visible wrapping, highlighted-line state, and line-step navigation aligned.

The later hardening work built on this same idea: if visible lines are a first-class UI contract, processor, UI, PTY tests, and agent stepping all need to derive behavior from the same line-map semantics.

## Prevention

- Measure the exact text that will be rendered, not the raw source string.
- Compute against content width, not terminal width; subtract padding, borders, and fixed chrome before wrapping.
- Treat terminal sanitization as a layout concern when line width, cursor position, or navigation depends on visible text.
- Keep one shared line-map contract for rendering, line stepping, and highlight positioning.
- Add width-sensitive regression tests for padded containers and control-sequence-heavy tokens.
- Prefer PTY tests for terminal UI behavior that depends on actual wrapping and resize events.

## Related Issues

- Terminal sanitization baseline: `docs/solutions/runtime-errors/terminal-startup-lifecycle-and-input-hardening-cli-runtime-20260305.md`
- Parallel reading-mode hardening precedent: `docs/solutions/logic-errors/20260305-chunked-mode-behavior-parity-hardening-fixes.md`
- Mode-specific parity and display correctness precedent: `docs/solutions/logic-errors/20260306-bionic-mode-p2-hardening-parity-validation-caching-unicode-safety.md`
- Related terminal layout contract bug: `docs/solutions/ui-bugs/20260305-rsvp-words-not-vertically-centered-terminal-layout.md`
- Guided scroll PTY validation artifact: `docs/validation/2026-03-06-guided-scroll-acceptance-pty.md`
