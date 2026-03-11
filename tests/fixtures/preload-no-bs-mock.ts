export {};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const scenario = process.env.RFAF_NO_BS_MOCK_SCENARIO ?? "language-mismatch";

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildResponse(cleanedText: string): Response {
  return new Response(
    JSON.stringify({
      id: "resp_no_bs_mock",
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
          id: "msg_no_bs_mock",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ cleaned_text: cleanedText }),
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
      throw new Error(`UNMOCKED_FETCH_URL:${url}`);
    }

    if (scenario === "language-mismatch") {
      return buildResponse("This cleaned text is translated into English and violates language contract.");
    }

  if (scenario === "content-truncation") {
    return buildResponse(
      "Black Sabbath was an English rock band formed in Birmingham in 1968 by guitarist Tony Iommi and bassist Geezer Butler."
    );
  }

    return buildResponse("Texto limpio en espanol que mantiene el idioma original.");
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
