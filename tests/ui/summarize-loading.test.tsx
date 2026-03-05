import { describe, expect, it } from "bun:test";
import { createLoadingIndicator } from "../../src/cli/loading-indicator";

function createMockStream(isTTY: boolean) {
  let output = "";

  return {
    get output() {
      return output;
    },
    stream: {
      isTTY,
      write(chunk: string) {
        output += chunk;
        return true;
      },
    } as unknown as NodeJS.WriteStream,
  };
}

describe("summarize loading indicator", () => {
  it("shows deterministic non-tty progress messages", () => {
    const mock = createMockStream(false);
    const indicator = createLoadingIndicator({
      message: "summarizing",
      stream: mock.stream,
    });

    indicator.start();
    indicator.succeed("done");
    indicator.stop();

    expect(mock.output).toContain("Summarizing: summarizing");
    expect(mock.output).toContain("[ok] done");
  });

  it("renders animated tty frames and clears line on stop", async () => {
    const mock = createMockStream(true);
    const indicator = createLoadingIndicator({
      message: "summarizing",
      stream: mock.stream,
      intervalMs: 5,
    });

    indicator.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    indicator.stop();

    expect(mock.output).toContain("\r");
    expect(mock.output).toContain("\x1b[2K");
  });
});
