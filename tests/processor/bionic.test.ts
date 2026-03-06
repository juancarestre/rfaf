import { describe, expect, it } from "bun:test";
import {
  applyBionicMode,
  resolveBionicPrefixLength,
} from "../../src/processor/bionic";
import type { Word } from "../../src/processor/types";

function word(text: string, index: number): Word {
  return {
    text,
    index,
    paragraphIndex: 0,
    isParagraphStart: index === 0,
    trailingPunctuation: null,
  };
}

describe("bionic transform", () => {
  it("keeps word ordering and count stable", () => {
    const input = [word("alpha", 0), word("beta", 1), word("gamma", 2)];
    const output = applyBionicMode(input);

    expect(output).toHaveLength(input.length);
    expect(output.map((entry) => entry.text.toLowerCase())).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(output.map((entry) => entry.index)).toEqual([0, 1, 2]);
  });

  it("uses conservative prefix emphasis for typical words", () => {
    expect(resolveBionicPrefixLength("go")).toBe(0);
    expect(resolveBionicPrefixLength("focus")).toBe(1);
    expect(resolveBionicPrefixLength("reader")).toBe(2);
  });

  it("selectively increases emphasis for long or dense words", () => {
    expect(resolveBionicPrefixLength("internationalization")).toBe(4);
    expect(resolveBionicPrefixLength("state-of-the-art")).toBe(3);
  });

  it("does not produce empty display words", () => {
    const output = applyBionicMode([word("A", 0), word("I/O", 1)]);
    expect(output[0]?.text.length).toBeGreaterThan(0);
    expect(output[1]?.text.length).toBeGreaterThan(0);
  });

  it("emphasizes only the computed prefix of alphanumeric characters", () => {
    const output = applyBionicMode([
      word("reader", 0),
      word("state-of-the-art", 1),
    ]);

    expect(output[0]?.text).toBe("REader");
    expect(output[1]?.text).toBe("STAte-of-the-art");
  });
});
