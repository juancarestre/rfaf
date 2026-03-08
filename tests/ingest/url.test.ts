import { describe, expect, it } from "bun:test";
import { DEFAULT_MAX_INPUT_BYTES } from "../../src/ingest/constants";
import { readUrl } from "../../src/ingest/url";

const ARTICLE_PARAGRAPH =
  "The quick brown fox jumps over the lazy dog while a curious reader verifies that this paragraph is long enough for readability extraction to treat it as article content.";

function htmlDocument(body: string, title = "My Article"): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    `<title>${title}</title>`,
    "</head>",
    `<body>${body}</body>`,
    "</html>",
  ].join("");
}

function htmlResponse(html: string, headers: Record<string, string> = {}): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

describe("readUrl", () => {
  it("extracts article content from html pages", async () => {
    const response = htmlResponse(
      htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p><p>Second paragraph here.</p></article>`)
    );

    const doc = await readUrl("https://example.com/article", {
      fetchFn: async () => response,
    });

    expect(doc.content).toContain("The quick brown fox jumps over the lazy dog");
    expect(doc.source).toBe("My Article");
    expect(doc.wordCount).toBeGreaterThan(10);
  });

  it("uses extracted html title as source", async () => {
    const doc = await readUrl("https://example.com/title", {
      fetchFn: async () =>
        htmlResponse(htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`, "A Better Title")),
    });

    expect(doc.source).toBe("A Better Title");
  });

  it("falls back to url when title is missing", async () => {
    const doc = await readUrl("https://example.com/no-title", {
      fetchFn: async () =>
        htmlResponse(
          [
            "<!doctype html>",
            "<html>",
            "<body>",
            `<article><p>${ARTICLE_PARAGRAPH}</p></article>`,
            "</body>",
            "</html>",
          ].join("")
        ),
    });

    expect(doc.source).toBe("https://example.com/no-title");
  });

  it("throws when article extraction fails", async () => {
    await expect(
      readUrl("https://example.com/scripts-only", {
        fetchFn: async () =>
          htmlResponse("<html><head></head><body><script>console.log('x')</script></body></html>"),
      })
    ).rejects.toThrow("Could not extract article content from https://example.com/scripts-only");
  });

  it("throws when extracted text is whitespace", async () => {
    await expect(
      readUrl("https://example.com/blank", {
        fetchFn: async () =>
          htmlResponse(htmlDocument("<article><p> </p><p>\n\n</p></article>")),
      })
    ).rejects.toThrow("Could not extract article content from https://example.com/blank");
  });

  it("throws when extracted text exceeds max size", async () => {
    await expect(
      readUrl("https://example.com/too-large", {
        maxBytes: 128,
        fetchFn: async () =>
          htmlResponse(htmlDocument(`<article><p>${"A ".repeat(200)}</p></article>`)),
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("accepts extracted text at size boundary", async () => {
    const content = "A".repeat(DEFAULT_MAX_INPUT_BYTES);

    const doc = await readUrl("https://example.com/boundary", {
      fetchFn: async () =>
        new Response(content, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        }),
    });

    expect(doc.content.length).toBe(DEFAULT_MAX_INPUT_BYTES);
  });

  it("maps timeout failures to a deterministic timeout message", async () => {
    await expect(
      readUrl("https://example.com/timeout", {
        timeoutMs: 5,
        fetchFn: async (_input: RequestInfo | URL, init?: RequestInit) => {
          await new Promise<never>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              },
              { once: true }
            );
          });

          throw new Error("unreachable");
        },
      })
    ).rejects.toThrow("Timed out fetching https://example.com/timeout (5ms limit)");
  });

  it("maps external abort signals to cancellation message", async () => {
    const controller = new AbortController();
    controller.abort(new Error("SIGINT"));

    await expect(
      readUrl("https://example.com/cancelled", {
        signal: controller.signal,
        fetchFn: async () => {
          throw new DOMException("The operation was aborted.", "AbortError");
        },
      })
    ).rejects.toThrow("Fetching https://example.com/cancelled cancelled");
  });

  it("surfaces HTTP 404 responses", async () => {
    await expect(
      readUrl("https://example.com/404", {
        fetchFn: async () => new Response("missing", { status: 404 }),
      })
    ).rejects.toThrow("HTTP 404 fetching https://example.com/404");
  });

  it("surfaces HTTP 500 responses", async () => {
    await expect(
      readUrl("https://example.com/500", {
        fetchFn: async () => new Response("boom", { status: 500 }),
      })
    ).rejects.toThrow("HTTP 500 fetching https://example.com/500");
  });

  it("surfaces HTTP 403 responses", async () => {
    await expect(
      readUrl("https://example.com/403", {
        fetchFn: async () => new Response("forbidden", { status: 403 }),
      })
    ).rejects.toThrow("HTTP 403 fetching https://example.com/403");
  });

  it("does not misclassify HTTP failures when URL contains timeout", async () => {
    await expect(
      readUrl("https://example.com/timeout/path", {
        fetchFn: async () => new Response("missing", { status: 404 }),
      })
    ).rejects.toThrow("HTTP 404 fetching https://example.com/timeout/path");
  });

  it("does not misclassify HTTP failures when URL contains abort", async () => {
    await expect(
      readUrl("https://example.com/abort/path", {
        fetchFn: async () => new Response("forbidden", { status: 403 }),
      })
    ).rejects.toThrow("HTTP 403 fetching https://example.com/abort/path");
  });

  it("rejects unsupported content types", async () => {
    await expect(
      readUrl("https://example.com/json", {
        fetchFn: async () =>
          new Response('{"ok":true}', {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
      })
    ).rejects.toThrow("Unsupported content type: application/json from https://example.com/json");
  });

  it("accepts text/plain content and bypasses readability", async () => {
    const doc = await readUrl("https://example.com/plain", {
      fetchFn: async () =>
        new Response("raw plain text input", {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
        }),
    });

    expect(doc.content).toBe("raw plain text input");
    expect(doc.source).toBe("https://example.com/plain");
    expect(doc.wordCount).toBe(4);
  });

  it("sends a browser-like user agent", async () => {
    let init: RequestInit | undefined;

    await readUrl("https://example.com/ua", {
      fetchFn: async (
        _input: RequestInfo | URL,
        requestInit?: RequestInit
      ) => {
        init = requestInit;
        return htmlResponse(htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`));
      },
    });

    const headers = init?.headers as HeadersInit;
    const normalized = new Headers(headers);
    expect(normalized.get("user-agent")).toContain("Mozilla/5.0");
  });

  it("passes an AbortSignal to fetch", async () => {
    let init: RequestInit | undefined;

    await readUrl("https://example.com/signal", {
      fetchFn: async (
        _input: RequestInfo | URL,
        requestInit?: RequestInit
      ) => {
        init = requestInit;
        return htmlResponse(htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`));
      },
    });

    expect(init?.signal).toBeDefined();
  });

  it("decodes html entities in extracted title", async () => {
    const doc = await readUrl("https://example.com/entities", {
      fetchFn: async () =>
        htmlResponse(
          htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`, "&amp; &mdash; test")
        ),
    });

    expect(doc.source).toBe("& — test");
  });

  it("strips script and style text from extracted article content", async () => {
    const doc = await readUrl("https://example.com/clean", {
      fetchFn: async () =>
        htmlResponse(
          htmlDocument(
            `<article><style>body { color: red; }</style><script>window.bad = true</script><p>${ARTICLE_PARAGRAPH}</p></article>`
          )
        ),
    });

    expect(doc.content).not.toContain("window.bad");
    expect(doc.content).not.toContain("color: red");
  });

  it("supports minimal article pages", async () => {
    const doc = await readUrl("https://example.com/minimal", {
      fetchFn: async () =>
        htmlResponse(
          htmlDocument(
            `<article><p>${ARTICLE_PARAGRAPH} ${ARTICLE_PARAGRAPH}</p></article>`
          )
        ),
    });

    expect(doc.wordCount).toBeGreaterThan(20);
  });

  it("rejects large responses based on content-length header", async () => {
    await expect(
      readUrl("https://example.com/huge", {
        fetchFn: async () =>
          htmlResponse(htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`), {
            "content-length": "20000000",
          }),
      })
    ).rejects.toThrow("Response too large from https://example.com/huge");
  });

  it("rejects large responses when content-length header is missing", async () => {
    await expect(
      readUrl("https://example.com/no-length", {
        maxResponseBytes: 100,
        fetchFn: async () =>
          new Response("A".repeat(200), {
            status: 200,
            headers: {
              "content-type": "text/plain",
            },
          }),
      })
    ).rejects.toThrow("Response too large from https://example.com/no-length");
  });

  it("honors custom maxBytes option", async () => {
    await expect(
      readUrl("https://example.com/custom-max", {
        maxBytes: 100,
        fetchFn: async () =>
          new Response("A".repeat(200), {
            status: 200,
            headers: {
              "content-type": "text/plain",
            },
          }),
      })
    ).rejects.toThrow("Input exceeds maximum supported size");
  });

  it("fails fast when page is not probably readerable", async () => {
    await expect(
      readUrl("https://example.com/nav", {
        fetchFn: async () =>
          htmlResponse(
            htmlDocument(
              "<nav><a href='/a'>A</a><a href='/b'>B</a><a href='/c'>C</a><a href='/d'>D</a></nav>"
            )
          ),
      })
    ).rejects.toThrow("Could not extract article content from https://example.com/nav");
  });

  it("sanitizes ansi escape sequences in extracted titles", async () => {
    const doc = await readUrl("https://example.com/ansi-title", {
      fetchFn: async () =>
        htmlResponse(
          htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`, "\u001b[2J Evil")
        ),
    });

    expect(doc.source).toBe(" Evil");
  });

  it("sanitizes control characters in extracted titles", async () => {
    const doc = await readUrl("https://example.com/control-title", {
      fetchFn: async () =>
        htmlResponse(
          htmlDocument(`<article><p>${ARTICLE_PARAGRAPH}</p></article>`, "\u0000\u0007 Test")
        ),
    });

    expect(doc.source).toBe(" Test");
  });
});
