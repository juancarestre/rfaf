import { describe, expect, it } from "bun:test";
import { getORPIndex } from "../../src/ui/orp";

describe("getORPIndex", () => {
  describe("lookup table correctness", () => {
    it("returns 0 for 1-character words", () => {
      expect(getORPIndex(1)).toBe(0);
    });

    it("returns 1 for 2-character words", () => {
      expect(getORPIndex(2)).toBe(1);
    });

    it("returns 1 for 3-character words", () => {
      expect(getORPIndex(3)).toBe(1);
    });

    it("returns 1 for 4-character words", () => {
      expect(getORPIndex(4)).toBe(1);
    });

    it("returns 1 for 5-character words", () => {
      expect(getORPIndex(5)).toBe(1);
    });

    it("returns 2 for 6-character words", () => {
      expect(getORPIndex(6)).toBe(2);
    });

    it("returns 2 for 9-character words", () => {
      expect(getORPIndex(9)).toBe(2);
    });

    it("returns 3 for 10-character words", () => {
      expect(getORPIndex(10)).toBe(3);
    });

    it("returns 3 for 13-character words", () => {
      expect(getORPIndex(13)).toBe(3);
    });

    it("returns 4 for 14-character words", () => {
      expect(getORPIndex(14)).toBe(4);
    });

    it("returns 4 for very long words (20+ chars)", () => {
      expect(getORPIndex(20)).toBe(4);
      expect(getORPIndex(30)).toBe(4);
    });
  });

  describe("edge cases", () => {
    it("handles 0-length (returns 0)", () => {
      expect(getORPIndex(0)).toBe(0);
    });
  });
});
