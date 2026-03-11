export {};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const LONG_INPUT_THRESHOLD_BYTES = 10_000;
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

function extractNoBsSourceText(init?: RequestInit): string {
  if (!init?.body || typeof init.body !== "string") {
    return "";
  }

  try {
    const parsed = JSON.parse(init.body) as unknown;
    const strings: string[] = [];
    collectStrings(parsed, strings);
    for (const candidate of strings) {
      if (!candidate.includes("<source_text>")) {
        continue;
      }

      const open = "<source_text>\n\n";
      const close = "\n\n</source_text>";
      const start = candidate.indexOf(open);
      const end = candidate.lastIndexOf(close);
      if (start >= 0 && end > start) {
        return candidate.slice(start + open.length, end);
      }
    }
  } catch {
    return "";
  }

  return "";
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

    if (scenario === "long-input-chunk-required") {
      const source = extractNoBsSourceText(init);
      if (Buffer.byteLength(source, "utf8") >= LONG_INPUT_THRESHOLD_BYTES) {
        return buildResponse(
          "Black Sabbath was an English rock band formed in Birmingham in 1968 by guitarist Tony Iommi and bassist Geezer Butler."
        );
      }

      return buildResponse(source);
    }

    return buildResponse("Texto limpio en espanol que mantiene el idioma original.");
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
