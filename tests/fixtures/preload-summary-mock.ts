export {};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const LONG_INPUT_THRESHOLD_BYTES = 10_000;

const scenario = process.env.RFAF_SUMMARY_MOCK_SCENARIO ?? "language-mismatch";

const originalFetch = fetch;

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildResponseSummary(summary: string): Response {
  return new Response(
    JSON.stringify({
      id: "resp_summary_mock",
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: "gpt-4o-mini",
      usage: {
        input_tokens: 120,
        output_tokens: 40,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
      output: [
        {
          type: "message",
          id: "msg_summary_mock",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ summary }),
              annotations: [],
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );
}

function collectStrings(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, output);
    }
  }
}

function extractSummarySourceText(init?: RequestInit): string {
  if (!init?.body || typeof init.body !== "string") {
    return "";
  }

  try {
    const parsed = JSON.parse(init.body) as unknown;
    const strings: string[] = [];
    collectStrings(parsed, strings);
    for (const candidate of strings) {
      if (!candidate.includes("Text to summarize:")) {
        continue;
      }

      const section = candidate.split("Text to summarize:\n\n")[1];
      if (section) {
        return section;
      }
    }
  } catch {
    return "";
  }

  return "";
}

function summarizeWithinBounds(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const target = Math.max(1, Math.ceil(words.length * 0.4));
  return words.slice(0, target).join(" ");
}

const mockedFetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlFromInput(input);

    if (!url.startsWith(OPENAI_RESPONSES_URL)) {
      return originalFetch(input, init);
    }

    if (scenario === "language-mismatch") {
      return buildResponseSummary(
        "This summary is in English and intentionally violates language preservation."
      );
    }

    if (scenario === "length-mismatch") {
      return buildResponseSummary("Too short.");
    }

    if (scenario === "long-input-chunk-required") {
      const source = extractSummarySourceText(init);
      if (Buffer.byteLength(source, "utf8") >= LONG_INPUT_THRESHOLD_BYTES) {
        return buildResponseSummary("Too short.");
      }

      return buildResponseSummary(summarizeWithinBounds(source));
    }

    return buildResponseSummary("Resumen en espanol que respeta el idioma original.");
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
