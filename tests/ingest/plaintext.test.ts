import { describe, expect, it } from "bun:test";
import { readPlaintextFile } from "../../src/ingest/plaintext";

describe("readPlaintextFile", () => {
  it("reads a valid text file", async () => {
    const doc = await readPlaintextFile("tests/fixtures/one-word.txt");
    expect(doc.content).toBe("Hello");
    expect(doc.source).toBe("tests/fixtures/one-word.txt");
    expect(doc.wordCount).toBe(1);
  });

  it("reads multi-line text files", async () => {
    const doc = await readPlaintextFile("tests/fixtures/sample.txt");
    expect(doc.content.length).toBeGreaterThan(100);
    expect(doc.wordCount).toBeGreaterThan(50);
  });

  it("throws when file does not exist", async () => {
    await expect(readPlaintextFile("tests/fixtures/missing.txt")).rejects.toThrow(
      "File not found"
    );
  });

  it("throws when file is empty", async () => {
    await expect(readPlaintextFile("tests/fixtures/empty.txt")).rejects.toThrow(
      "File is empty"
    );
  });

  it("throws when file is whitespace-only", async () => {
    await expect(
      readPlaintextFile("tests/fixtures/whitespace-only.txt")
    ).rejects.toThrow("File is empty");
  });

  it("throws when file appears binary (contains null bytes)", async () => {
    await expect(readPlaintextFile("tests/fixtures/binary.bin")).rejects.toThrow(
      "Binary file detected"
    );
  });
});
