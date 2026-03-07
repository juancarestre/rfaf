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

  it("detects https url arguments", () => {
    const result = resolveInputSource({
      fileArg: "https://example.com/article",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("url");
    if (result.kind === "url") {
      expect(result.url).toBe("https://example.com/article");
      expect(result.warning).toBeUndefined();
    }
  });

  it("detects http url arguments", () => {
    const result = resolveInputSource({
      fileArg: "http://example.com/article",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("url");
    if (result.kind === "url") {
      expect(result.url).toBe("http://example.com/article");
    }
  });

  it("detects url arguments case-insensitively", () => {
    const result = resolveInputSource({
      fileArg: "HTTPS://EXAMPLE.COM",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("url");
    if (result.kind === "url") {
      expect(result.url).toBe("HTTPS://EXAMPLE.COM");
    }
  });

  it("uses url argument and warns if stdin is piped", () => {
    const result = resolveInputSource({
      fileArg: "https://x.com",
      stdinIsPiped: true,
    });

    expect(result.kind).toBe("url");
    if (result.kind === "url") {
      expect(result.url).toBe("https://x.com");
      expect(result.warning).toContain("ignoring piped stdin");
    }
  });

  it("does not treat ftp protocol as url input", () => {
    const result = resolveInputSource({
      fileArg: "ftp://example.com",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("file");
    if (result.kind === "file") {
      expect(result.path).toBe("ftp://example.com");
    }
  });

  it("does not treat bare domains as url input", () => {
    const result = resolveInputSource({
      fileArg: "example.com/article",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("file");
    if (result.kind === "file") {
      expect(result.path).toBe("example.com/article");
    }
  });

  it("treats protocol-only strings as url input", () => {
    const result = resolveInputSource({
      fileArg: "https://",
      stdinIsPiped: false,
    });

    expect(result.kind).toBe("url");
    if (result.kind === "url") {
      expect(result.url).toBe("https://");
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
