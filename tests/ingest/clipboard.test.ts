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

  it("continues probing fallback backends after a runtime backend failure", async () => {
    const calls: string[] = [];

    const doc = await readClipboard({
      platform: "linux",
      runClipboardCommand: async (command: string[]) => {
        calls.push(command[0]);

        if (command[0] === "wl-paste") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "backend crashed",
            timedOut: false,
          };
        }

        if (command[0] === "xclip") {
          return {
            exitCode: 0,
            stdout: "fallback clipboard content",
            stderr: "",
            timedOut: false,
          };
        }

        return {
          exitCode: 1,
          stdout: "",
          stderr: "not reached",
          timedOut: false,
        };
      },
    });

    expect(calls).toEqual(["wl-paste", "xclip"]);
    expect(doc.content).toBe("fallback clipboard content");
  });

  it("maps display/session backend failures to unavailable contract", async () => {
    await expect(
      readClipboard({
        platform: "linux",
        runClipboardCommand: async () => {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "Can't open display: (null)",
            timedOut: false,
          };
        },
      })
    ).rejects.toThrow("Clipboard is unavailable on this system");
  });

  it("passes configured backend timeout to clipboard command runner", async () => {
    const seenTimeouts: number[] = [];

    const doc = await readClipboard({
      platform: "linux",
      backendTimeoutMs: 42,
      runClipboardCommand: async (command: string[], timeoutMs: number) => {
        seenTimeouts.push(timeoutMs);
        if (command[0] === "xsel") {
          return {
            exitCode: 0,
            stdout: "final backend success",
            stderr: "",
            timedOut: false,
          };
        }

        return {
          exitCode: 1,
          stdout: "",
          stderr: "command not found",
          timedOut: false,
        };
      },
    });

    expect(seenTimeouts).toEqual([42, 42, 42]);
    expect(doc.content).toBe("final backend success");
  });

  it("keeps probing when a backend probe times out", async () => {
    const doc = await readClipboard({
      platform: "linux",
      runClipboardCommand: async (command: string[]) => {
        if (command[0] === "wl-paste") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "clipboard backend timed out after 10ms",
            timedOut: true,
          };
        }

        return {
          exitCode: 0,
          stdout: "clipboard from fallback backend",
          stderr: "",
          timedOut: false,
        };
      },
    });

    expect(doc.content).toBe("clipboard from fallback backend");
  });
});
