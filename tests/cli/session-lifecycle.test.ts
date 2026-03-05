import { describe, expect, it } from "bun:test";
import { runSessionLifecycle } from "../../src/cli/session-lifecycle";

describe("runSessionLifecycle", () => {
  it("restores terminal and input cleanup when render throws", async () => {
    const events: string[] = [];

    await expect(
      runSessionLifecycle({
        useAlternateScreen: true,
        getInputStream: () => ({
          stdin: {} as NodeJS.ReadStream,
          cleanup: () => events.push("cleanup"),
        }),
        enterAlternateScreen: () => events.push("enter"),
        exitAlternateScreen: () => events.push("exit"),
        renderApp: () => {
          events.push("render");
          throw new Error("render failed");
        },
      })
    ).rejects.toThrow("render failed");

    expect(events).toEqual(["enter", "render", "cleanup", "exit"]);
  });

  it("does not enter alternate screen when stdin is unavailable", async () => {
    const events: string[] = [];

    await expect(
      runSessionLifecycle({
        useAlternateScreen: true,
        getInputStream: () => ({
          stdin: undefined,
          cleanup: () => events.push("cleanup"),
        }),
        enterAlternateScreen: () => events.push("enter"),
        exitAlternateScreen: () => events.push("exit"),
        renderApp: () => {
          throw new Error("should not render");
        },
      })
    ).rejects.toThrow("Interactive terminal input is required");

    expect(events).toEqual(["cleanup"]);
  });
});
