import { describe, expect, it } from "bun:test";
import { StrategyRuntimeError, UserCancelledError } from "../../src/cli/errors";
import {
  MAX_STRATEGY_INPUT_CHARS,
  MAX_STRATEGY_RETRIES,
  MAX_STRATEGY_TIMEOUT_MS,
  resolveModeAfterStrategy,
  strategyBeforeRsvp,
} from "../../src/cli/strategy-flow";

function createLoadingSpy() {
  const events: string[] = [];

  return {
    events,
    factory: () => ({
      start: () => {
        events.push("start");
      },
      stop: () => {
        events.push("stop");
      },
      succeed: (message?: string) => {
        events.push(`succeed:${message ?? ""}`);
      },
      fail: (message?: string) => {
        events.push(`fail:${message ?? ""}`);
      },
    }),
  };
}

describe("strategyBeforeRsvp", () => {
  it("bypasses strategy when option is disabled", async () => {
    const result = await strategyBeforeRsvp({
      documentContent: "source text",
      strategyOption: { enabled: false },
      selectedMode: "rsvp",
      explicitModeProvided: false,
    });

    expect(result).toEqual({
      recommendedMode: null,
      rationale: null,
      warning: null,
    });
  });

  it("warns and continues when config cannot be loaded", async () => {
    const result = await strategyBeforeRsvp({
      documentContent: "source text",
      strategyOption: { enabled: true },
      selectedMode: "rsvp",
      explicitModeProvided: false,
      loadConfig: () => {
        throw new Error("Config error: missing config file at ~/.rfaf/config.toml");
      },
    });

    expect(result.recommendedMode).toBeNull();
    expect(result.rationale).toBeNull();
    expect(result.warning).toContain("Strategy unavailable [config]");
  });

  it("reports recommendation and starts in recommended mode when mode is not explicit", async () => {
    const loadingSpy = createLoadingSpy();

    const result = await strategyBeforeRsvp({
      documentContent: "source text",
      strategyOption: { enabled: true },
      selectedMode: "rsvp",
      explicitModeProvided: false,
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 500,
        maxRetries: 0,
      }),
      recommend: async () => ({
        mode: "chunked",
        rationale: "Long clauses read better in phrase groups.",
      }),
      createLoading: loadingSpy.factory,
    });

    expect(result).toEqual({
      recommendedMode: "chunked",
      rationale: "Long clauses read better in phrase groups.",
      warning: null,
    });
    expect(loadingSpy.events).toContain("start");
    expect(loadingSpy.events).toContain("stop");
    expect(loadingSpy.events.some((event) => event.includes("strategy recommends chunked"))).toBe(true);
    expect(loadingSpy.events.some((event) => event.includes("starting mode=chunked"))).toBe(true);
  });

  it("keeps explicit mode and reports would-have-picked output", async () => {
    const loadingSpy = createLoadingSpy();

    const result = await strategyBeforeRsvp({
      documentContent: "source text",
      strategyOption: { enabled: true },
      selectedMode: "scroll",
      explicitModeProvided: true,
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 500,
        maxRetries: 0,
      }),
      recommend: async () => ({
        mode: "chunked",
        rationale: "Dense text benefits from phrase grouping.",
      }),
      createLoading: loadingSpy.factory,
    });

    expect(result.recommendedMode).toBe("chunked");
    expect(result.rationale).toBe("Dense text benefits from phrase grouping.");
    expect(loadingSpy.events.some((event) => event.includes("keeping --mode=scroll"))).toBe(true);
  });

  it("returns warning for strategy runtime errors without throwing", async () => {
    const loadingSpy = createLoadingSpy();

    const result = await strategyBeforeRsvp({
      documentContent: "source text",
      strategyOption: { enabled: true },
      selectedMode: "rsvp",
      explicitModeProvided: false,
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 500,
        maxRetries: 0,
      }),
      recommend: async () => {
        throw new StrategyRuntimeError(
          "Strategy failed [schema]: provider returned invalid structured output.",
          "schema"
        );
      },
      createLoading: loadingSpy.factory,
    });

    expect(result.recommendedMode).toBeNull();
    expect(result.rationale).toBeNull();
    expect(result.warning).toContain("Strategy failed [schema]");
    expect(result.warning).toContain("provider=openai");
    expect(result.warning).toContain("model=gpt-5-mini");
    expect(loadingSpy.events.some((event) => event.startsWith("fail:"))).toBe(false);
  });

  it("bounds strategy input and clamps timeout/retry budget", async () => {
    let capturedInput = "";
    let capturedTimeout = -1;
    let capturedRetries = -1;

    const result = await strategyBeforeRsvp({
      documentContent: "x".repeat(MAX_STRATEGY_INPUT_CHARS * 3),
      strategyOption: { enabled: true },
      selectedMode: "rsvp",
      explicitModeProvided: false,
      loadConfig: () => ({
        provider: "openai",
        model: "gpt-5-mini",
        apiKey: "test",
        defaultPreset: "medium",
        timeoutMs: 20_000,
        maxRetries: 5,
      }),
      recommend: async ({ input, timeoutMs, maxRetries }) => {
        capturedInput = input;
        capturedTimeout = timeoutMs;
        capturedRetries = maxRetries;
        return {
          mode: "chunked",
          rationale: "Bounded strategy input still yields a stable recommendation.",
        };
      },
      createLoading: createLoadingSpy().factory,
    });

    expect(result.recommendedMode).toBe("chunked");
    expect(result.warning).toBeNull();
    expect(capturedInput.length).toBeLessThanOrEqual(MAX_STRATEGY_INPUT_CHARS);
    expect(capturedInput).toContain("strategy input truncated");
    expect(capturedTimeout).toBe(MAX_STRATEGY_TIMEOUT_MS);
    expect(capturedRetries).toBe(MAX_STRATEGY_RETRIES);
  });

  it("throws user-cancelled when SIGINT occurs during strategy", async () => {
    const parentAbort = new AbortController();

    await expect(
      strategyBeforeRsvp({
        documentContent: "source text",
        strategyOption: { enabled: true },
        selectedMode: "rsvp",
        explicitModeProvided: false,
        signal: parentAbort.signal,
        captureSigInt: false,
        loadConfig: () => ({
          provider: "openai",
          model: "gpt-5-mini",
          apiKey: "test",
          defaultPreset: "medium",
          timeoutMs: 500,
          maxRetries: 0,
        }),
        recommend: async ({ signal }) => {
          queueMicrotask(() => {
            parentAbort.abort(new Error("SIGINT"));
          });
          await new Promise<never>((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => {
                reject(signal.reason ?? new Error("aborted"));
              },
              { once: true }
            );
          });

          return {
            mode: "rsvp",
            rationale: "should not happen",
          };
        },
        createLoading: createLoadingSpy().factory,
      })
    ).rejects.toBeInstanceOf(UserCancelledError);
  });

  it("resolves effective mode from recommendation only when --mode is not explicit", () => {
    expect(
      resolveModeAfterStrategy({
        selectedMode: "rsvp",
        explicitModeProvided: false,
        recommendedMode: "chunked",
      })
    ).toBe("chunked");

    expect(
      resolveModeAfterStrategy({
        selectedMode: "scroll",
        explicitModeProvided: true,
        recommendedMode: "chunked",
      })
    ).toBe("scroll");

    expect(
      resolveModeAfterStrategy({
        selectedMode: "rsvp",
        explicitModeProvided: false,
        recommendedMode: null,
      })
    ).toBe("rsvp");
  });
});
