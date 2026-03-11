export {};

const ARTICLE_URL = "https://example.com/article";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const scenario = process.env.RFAF_URL_MOCK_SCENARIO ?? "success";
const summaryText =
  process.env.RFAF_URL_MOCK_SUMMARY_TEXT ??
  "The quick brown fox jumps over the lazy dog while this paragraph gives readability enough meaningful content to extract for speed reading tests. The quick brown fox jumps over the lazy dog while this paragraph gives readability enough meaningful content.";

const articleParagraph =
  "The quick brown fox jumps over the lazy dog while this paragraph gives readability enough meaningful content to extract for speed reading tests.";

const originalFetch = fetch;

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function buildArticleHtml(title: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    `<title>${title}</title>`,
    "</head>",
    "<body>",
    `<article><p>${articleParagraph}</p><p>${articleParagraph}</p></article>`,
    "</body>",
    "</html>",
  ].join("");
}

function openAiSuccessResponse(): Response {
  return new Response(
    JSON.stringify({
      id: "resp_mock",
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: "gpt-4o-mini",
      usage: {
        input_tokens: 120,
        output_tokens: 40,
        input_tokens_details: {
          cached_tokens: 0,
        },
        output_tokens_details: {
          reasoning_tokens: 0,
        },
      },
      output: [
        {
          type: "message",
          id: "msg_mock",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ summary: summaryText }),
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

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return originalFetch(input, init);
    }

    if (url.startsWith(OPENAI_RESPONSES_URL)) {
      if (scenario === "summary-success") {
        return openAiSuccessResponse();
      }

      return new Response("{}", {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (!url.startsWith(ARTICLE_URL)) {
      return new Response("Not found", { status: 404 });
    }

    if (scenario === "fetch-error") {
      throw new Error("network down");
    }

    if (scenario === "extraction-error") {
      return new Response(
        "<!doctype html><html><head><title>Broken</title></head><body><script>console.log('x')</script></body></html>",
        {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        }
      );
    }

    if (scenario === "ansi-title") {
      return new Response(buildArticleHtml("\u001b[2J Evil"), {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
    }

    if (scenario === "control-title") {
      return new Response(buildArticleHtml("\u0000\u0007 Test"), {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
    }

    return new Response(buildArticleHtml("Mock Article"), {
      status: 200,
      headers: {
        "content-type": "text/html",
      },
    });
  },
  {
    preconnect: fetch.preconnect,
  }
);

globalThis.fetch = mockedFetch as typeof fetch;
