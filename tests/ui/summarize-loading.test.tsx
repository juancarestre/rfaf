import { describe, expect, it } from "bun:test";
import { createLoadingIndicator } from "../../src/cli/loading-indicator";

function createMockStream(isTTY: boolean, columns = 80) {
  let output = "";

  return {
    get output() {
      return output;
    },
    stream: {
      isTTY,
      columns,
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

    expect(mock.output).toContain("summarizing");
    expect(mock.output).not.toContain("Summarizing:");
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

  it("truncates tty loading messages to avoid terminal line wrapping", () => {
    const mock = createMockStream(true, 30);
    const indicator = createLoadingIndicator({
      message: "https://example.com/this/path/is/very/long/and/would/wrap",
      stream: mock.stream,
      intervalMs: 1000,
    });

    indicator.start();
    indicator.stop();

    expect(mock.output).toContain("...");
    expect(mock.output).not.toContain("/and/would/wrap");
  });
});
