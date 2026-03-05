import { describe, expect, it } from "bun:test";
import { resolveInputSource } from "../../src/ingest/detect";

describe("resolveInputSource", () => {
  it("uses file argument when present", () => {
    const result = resolveInputSource({
      fileArg: "article.txt",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("file");
    if (result.kind === "file") {
      expect(result.path).toBe("article.txt");
      expect(result.warning).toBeUndefined();
    }
  });

  it("uses file argument and warns if stdin is piped", () => {
    const result = resolveInputSource({
      fileArg: "article.txt",
      stdinIsPiped: true,
    });

    expect(result.kind).toBe("file");
    if (result.kind === "file") {
      expect(result.path).toBe("article.txt");
      expect(result.warning).toContain("ignoring stdin");
    }
  });

  it("uses stdin when no file arg and stdin is piped", () => {
    const result = resolveInputSource({
      fileArg: undefined,
      stdinIsPiped: true,
    });
    expect(result.kind).toBe("stdin");
  });

  it("returns none when no file arg and no piped stdin", () => {
    const result = resolveInputSource({
      fileArg: undefined,
      stdinIsPiped: false,
    });
    expect(result.kind).toBe("none");
  });
});
