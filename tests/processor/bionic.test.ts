import { describe, expect, it } from "bun:test";
import {
  applyBionicMode,
  emphasizePrefixAlphaNumeric,
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
    expect(output.map((entry) => entry.text)).toEqual(["alpha", "beta", "gamma"]);
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

  it("stores prefix metadata without mutating canonical word text", () => {
    const output = applyBionicMode([
      word("reader", 0),
      word("state-of-the-art", 1),
    ]);

    expect(output[0]?.text).toBe("reader");
    expect(output[1]?.text).toBe("state-of-the-art");
    expect(output[0]?.bionicPrefixLength).toBe(2);
    expect(output[1]?.bionicPrefixLength).toBe(3);
  });

  it("applies visual emphasis on demand without changing source token", () => {
    expect(emphasizePrefixAlphaNumeric("reader", 2)).toBe("REader");
    expect(emphasizePrefixAlphaNumeric("state-of-the-art", 3)).toBe("STAte-of-the-art");
  });

  it("keeps canonical text stable for unicode words", () => {
    const output = applyBionicMode([word("straße", 0)]);
    expect(output[0]?.text).toBe("straße");
    expect(output[0]?.bionicPrefixLength).toBeGreaterThan(0);
  });
});
