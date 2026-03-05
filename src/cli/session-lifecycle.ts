export interface InteractiveInput {
  stdin?: NodeJS.ReadStream;
  cleanup: () => void;
}

export interface InkInstanceLike {
  waitUntilExit: () => Promise<unknown>;
}

interface RunSessionLifecycleOptions {
  useAlternateScreen: boolean;
  getInputStream: () => InteractiveInput;
  enterAlternateScreen: () => void;
  exitAlternateScreen: () => void;
  renderApp: (stdin: NodeJS.ReadStream) => InkInstanceLike;
}

export async function runSessionLifecycle(
  options: RunSessionLifecycleOptions
): Promise<void> {
  const input = options.getInputStream();
  let enteredAlternateScreen = false;

  try {
    if (!input.stdin) {
      throw new Error(
        "Interactive terminal input is required to run rfaf. Please run in a TTY terminal."
      );
    }

    if (options.useAlternateScreen) {
      options.enterAlternateScreen();
      enteredAlternateScreen = true;
    }

    const app = options.renderApp(input.stdin);
    await app.waitUntilExit();
  } finally {
    input.cleanup();
    if (enteredAlternateScreen) {
      options.exitAlternateScreen();
    }
  }
}
