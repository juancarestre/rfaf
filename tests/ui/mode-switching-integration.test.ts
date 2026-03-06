import { describe, expect, it } from "bun:test";
import type { Word } from "../../src/processor/types";
import {
  applyAppModeInput,
  createAppRuntimeState,
  switchAppReadingMode,
} from "../../src/ui/runtime-mode-state";

function makeWords(): Word[] {
  return [
    {
      text: "alpha",
      index: 0,
      paragraphIndex: 0,
      isParagraphStart: true,
      trailingPunctuation: null,
    },
    {
      text: "beta",
      index: 1,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "gamma",
      index: 2,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "clause_break",
    },
    {
      text: "delta",
      index: 3,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: null,
    },
    {
      text: "epsilon",
      index: 4,
      paragraphIndex: 0,
      isParagraphStart: false,
      trailingPunctuation: "sentence_end",
    },
  ];
}

describe("mode switching integration", () => {
  it("supports a full runtime cycle across all four modes", () => {
    const sourceWords = makeWords();
    const start = {
      ...createAppRuntimeState(sourceWords, "rsvp", 300),
      reader: {
        ...createAppRuntimeState(sourceWords, "rsvp", 300).reader,
        currentIndex: 2,
        state: "playing" as const,
      },
    };

    const chunked = switchAppReadingMode(start, sourceWords, "chunked", 1_000);
    const scroll = switchAppReadingMode(chunked, sourceWords, "scroll", 1_100);
    const bionic = switchAppReadingMode(scroll, sourceWords, "bionic", 1_200);

    expect(chunked.activeMode).toBe("chunked");
    expect(chunked.reader.state).toBe("paused");
    expect(scroll.activeMode).toBe("scroll");
    expect(scroll.reader.state).toBe("paused");
    expect(bionic.activeMode).toBe("bionic");
    expect(bionic.reader.words[bionic.reader.currentIndex]?.bionicPrefixLength).toBeGreaterThanOrEqual(0);
  });

  it("keeps the final state consistent under rapid switching", () => {
    const sourceWords = makeWords();
    let runtime = createAppRuntimeState(sourceWords, "rsvp", 300);

    runtime = switchAppReadingMode(runtime, sourceWords, "chunked", 1_000);
    runtime = switchAppReadingMode(runtime, sourceWords, "bionic", 1_001);
    runtime = switchAppReadingMode(runtime, sourceWords, "scroll", 1_002);

    expect(runtime.activeMode).toBe("scroll");
    expect(runtime.reader.state).toBe("paused");
  });

  it("blocks mode input while help is visible", () => {
    const sourceWords = makeWords();
    const runtime = {
      ...createAppRuntimeState(sourceWords, "rsvp", 300),
      helpVisible: true,
    };

    expect(applyAppModeInput(runtime, sourceWords, "4", 1_000)).toBe(runtime);
  });
});
