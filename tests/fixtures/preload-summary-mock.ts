export {};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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

    return buildResponseSummary("Resumen en espanol que respeta el idioma original.");
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
