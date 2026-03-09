import { describe, expect, it } from "bun:test";
import { readClipboard } from "../../src/ingest/clipboard";

describe("readClipboard", () => {
  it("reads clipboard content from injected reader", async () => {
    const doc = await readClipboard({
      readText: async () => "hello clipboard world",
    });

    expect(doc.content).toBe("hello clipboard world");
    expect(doc.source).toBe("clipboard");
    expect(doc.wordCount).toBe(3);
  });

  it("throws deterministic error when clipboard is empty", async () => {
    await expect(
      readClipboard({
        readText: async () => "   \n\t",
      })
    ).rejects.toThrow("Clipboard is empty");
  });

  it("throws deterministic error when clipboard exceeds byte limit", async () => {
    await expect(
      readClipboard({
        readText: async () => "A".repeat(64),
        maxBytes: 32,
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("normalizes unavailable backend errors", async () => {
    await expect(
      readClipboard({
        readText: async () => {
          throw new Error("no clipboard backend found");
        },
      })
    ).rejects.toThrow("Clipboard is unavailable on this system");
  });

  it("normalizes unknown backend errors", async () => {
    await expect(
      readClipboard({
        readText: async () => {
          throw new Error("unexpected clipboard backend panic");
        },
      })
    ).rejects.toThrow("Failed to read clipboard");
  });
});
