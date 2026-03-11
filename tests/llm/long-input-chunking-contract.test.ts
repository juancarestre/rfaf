import { describe, expect, it } from "bun:test";
import {
  DEFAULT_LONG_INPUT_CHUNK_BYTES,
  DEFAULT_LONG_INPUT_TRIGGER_BYTES,
  shouldUseLongInputChunking,
  splitIntoLongInputChunks,
} from "../../src/llm/long-input-chunking";
import { mergeLongInputChunks } from "../../src/llm/long-input-merge";

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function makeBytesAtLeast(size: number): string {
  const seed = "alpha beta gamma delta epsilon zeta eta theta iota kappa\n\n";
  let value = "";
  while (byteLength(value) < size) {
    value += seed;
  }
  return value;
}

describe("long-input chunking contract", () => {
  it("uses deterministic trigger threshold boundaries (N-1, N, N+1)", () => {
    const n = DEFAULT_LONG_INPUT_TRIGGER_BYTES;
    const under = makeBytesAtLeast(n - 1).slice(0, n - 1);
    const at = makeBytesAtLeast(n).slice(0, n);
    const over = makeBytesAtLeast(n + 1).slice(0, n + 1);

    expect(shouldUseLongInputChunking(under)).toBe(false);
    expect(shouldUseLongInputChunking(at)).toBe(true);
    expect(shouldUseLongInputChunking(over)).toBe(true);
  });

  it("splits deterministically with stable order and bounded chunk bytes", () => {
    const input = makeBytesAtLeast(DEFAULT_LONG_INPUT_TRIGGER_BYTES * 2);

    const first = splitIntoLongInputChunks(input, DEFAULT_LONG_INPUT_CHUNK_BYTES);
    const second = splitIntoLongInputChunks(input, DEFAULT_LONG_INPUT_CHUNK_BYTES);

    expect(first.length).toBeGreaterThan(1);
    expect(first).toEqual(second);
    expect(first.every((chunk) => byteLength(chunk) <= DEFAULT_LONG_INPUT_CHUNK_BYTES)).toBe(true);
  });

  it("merges chunks deterministically with separator and trim normalization", () => {
    const merged = mergeLongInputChunks(["  one\n", "\n\ntwo  ", "", "\nthree\n"]);
    expect(merged).toBe("one\n\ntwo\n\nthree");
    expect(mergeLongInputChunks(["one", "two", "three"])).toBe("one\n\ntwo\n\nthree");
  });
});
