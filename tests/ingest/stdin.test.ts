import { describe, expect, it } from "bun:test";
import { readStdin } from "../../src/ingest/stdin";

describe("readStdin", () => {
  it("reads stdin content from injected reader", async () => {
    const doc = await readStdin({
      readText: async () => "hello world",
    });

    expect(doc.content).toBe("hello world");
    expect(doc.source).toBe("stdin");
    expect(doc.wordCount).toBe(2);
  });

  it("throws when stdin is empty", async () => {
    await expect(
      readStdin({
        readText: async () => "   \n\t",
      })
    ).rejects.toThrow("File is empty");
  });

  it("throws when stdin exceeds byte limit", async () => {
    await expect(
      readStdin({
        readText: async () => "A".repeat(64),
        maxBytes: 32,
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });
});
