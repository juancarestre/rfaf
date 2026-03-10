export {};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const scenario = process.env.RFAF_KEY_PHRASES_MOCK_SCENARIO ?? "ok";

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildResponse(phrases: string[]): Response {
  return new Response(
    JSON.stringify({
      id: "resp_key_phrases_mock",
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
          id: "msg_key_phrases_mock",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ phrases }),
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
  async (input: RequestInfo | URL): Promise<Response> => {
    const url = urlFromInput(input);

    if (!url.startsWith(OPENAI_RESPONSES_URL)) {
      throw new Error(`UNMOCKED_FETCH_URL:${url}`);
    }

    if (scenario === "empty") {
      return buildResponse([]);
    }

    if (scenario === "ansi") {
      return buildResponse([
        "speed reading",
        "\u0007visual span\u0007",
        "eye movement",
      ]);
    }

    return buildResponse([
      "speed reading",
      "rapid serial visual presentation",
      "visual span",
      "eye movement",
      "maintaining comprehension",
    ]);
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
