// @vitest-environment node
// readOnlyFetch is server-only code, so it is tested in Node (where fetch's AbortError is a real Error).
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelError, explain, isAllowedPost, readOnlyJson, readOnlyText, redact, type FetchLike, type ReadOnlyRequest } from "@/lib/channels/readOnlyFetch";

// Synthetic values only. Nothing here is a real token, page or shop.
const TOKEN = "test-token-1234567890";
const SHOP_SECRET = "fake-secret-abcdef";
const GET_URL = "https://graph.facebook.com/v21.0/100000000000001?fields=name,followers_count";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_URL = "https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport";
const SHOPIFY_URL = "https://test-farm-shop.myshopify.com/admin/api/2024-10/graphql.json";
const SHOPIFY_QUERY = JSON.stringify({ query: "query { products(first: 5) { nodes { id title totalInventory } } }" });

interface RecordedCall {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  signal?: AbortSignal | null;
}

/** A fake fetch that records every call and answers with `respond`. Never touches the network. */
function recordingFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, headers: init?.headers as Record<string, string> | undefined, body: init?.body, cache: init?.cache, redirect: init?.redirect, signal: init?.signal });
    return respond(url, init);
  };
  return { fetchImpl, calls };
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Never answers until the request is aborted, like a real fetch to a silent server. */
function waitForAbort(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
  });
}

/** Awaits a request that must fail and returns the ChannelError it threw. */
async function caught(promise: Promise<unknown>): Promise<ChannelError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ChannelError);
    return error as ChannelError;
  }
  throw new Error("Expected the request to fail, but it succeeded.");
}

/** The exact secret must not appear in the message, stack, serialized error or the page explanation. */
function expectSecretHidden(error: ChannelError, secret: string) {
  expect(error.message).not.toContain(secret);
  expect(String(error.stack)).not.toContain(secret);
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(JSON.stringify({ message: error.message, kind: error.kind })).not.toContain(secret);
  expect(explain(error)).not.toContain(secret);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("readOnlyText and readOnlyJson: GET requests", () => {
  it("readOnlyText returns the raw text of a GET answer", async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response("<html><title>Test Farm</title></html>", { status: 200 }));
    const text = await readOnlyText("https://www.example-farm.test/", { fetchImpl });
    expect(text).toBe("<html><title>Test Farm</title></html>");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://www.example-farm.test/");
    expect(calls[0].method).toBe("GET");
    expect(calls[0].body).toBeUndefined();
  });

  it("readOnlyJson parses a JSON answer and passes headers through unchanged", async () => {
    const page = { id: "100000000000001", name: "Test Farm Page", followers_count: 1234 };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(page));
    const result = await readOnlyJson<typeof page>(GET_URL, { fetchImpl, headers: { Authorization: `Bearer ${TOKEN}` }, secrets: [TOKEN] });
    expect(result).toEqual(page);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: GET_URL, method: "GET", headers: { Authorization: `Bearer ${TOKEN}` } });
  });

  it("always asks fetch not to cache the answer", async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ ok: true }));
    await readOnlyJson(GET_URL, { fetchImpl });
    await readOnlyJson(SHOPIFY_URL, { method: "POST", body: SHOPIFY_QUERY, fetchImpl });
    expect(calls.map((c) => c.cache)).toEqual(["no-store", "no-store"]);
  });

  it("gives fetch an abort signal that is not aborted after a quick answer", async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ ok: true }));
    await readOnlyJson(GET_URL, { fetchImpl, timeoutMs: 20 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(calls[0].signal).toBeTruthy();
    expect(calls[0].signal?.aborted).toBe(false);
  });

  it("blocks a GET that tries to send a body before any request is made", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(GET_URL, { method: "GET", body: "name=changed", fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe("GET requests cannot send a body.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a GET with a body even when no method is given", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyJson(GET_URL, { body: "{}", fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("readOnlyText: blocked methods", () => {
  it.each(["PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])("%s is blocked before fetch is called", async (method) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(GET_URL, { method: method as ReadOnlyRequest["method"], fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe(`${method} requests are not allowed (read-only).`);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["PUT", SHOPIFY_URL],
    ["DELETE", SHOPIFY_URL],
    ["PATCH", GA4_URL],
    ["DELETE", TOKEN_URL],
  ])("%s is blocked even on an allow-listed address (%s)", async (method, url) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyJson(url, { method: method as ReadOnlyRequest["method"], body: SHOPIFY_QUERY, fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not accept a lower-case 'post' as a way around the allow-list", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText("https://api.line.me/v2/bot/message/broadcast", { method: "post" as ReadOnlyRequest["method"], body: "{}", fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("readOnlyText: allow-listed POST requests", () => {
  it("allows the Google sign-in token request and sends the body unchanged", async () => {
    const body = "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=fake.jwt.assertion";
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ access_token: "fake-access-abcdef", expires_in: 3599, token_type: "Bearer" }));
    const result = await readOnlyJson<{ access_token: string }>(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, fetchImpl });
    expect(result.access_token).toBe("fake-access-abcdef");
    expect(calls).toEqual([
      expect.objectContaining({ url: TOKEN_URL, method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store" }),
    ]);
  });

  it("allows a GA4 runReport request for a numeric property id", async () => {
    const body = JSON.stringify({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], metrics: [{ name: "sessions" }] });
    const report = { metricHeaders: [{ name: "sessions", type: "TYPE_INTEGER" }], rows: [{ metricValues: [{ value: "4321" }] }], rowCount: 1 };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(report));
    const result = await readOnlyJson(GA4_URL, { method: "POST", headers: { Authorization: "Bearer fake-access-abcdef" }, body, fetchImpl });
    expect(result).toEqual(report);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: GA4_URL, method: "POST", body });
  });

  it("allows a Shopify GraphQL query", async () => {
    const payload = { data: { products: { nodes: [{ id: "gid://shopify/Product/1", title: "Test Product A", totalInventory: 12 }] } } };
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse(payload));
    const result = await readOnlyJson(SHOPIFY_URL, { method: "POST", headers: { "X-Shopify-Access-Token": SHOP_SECRET }, body: SHOPIFY_QUERY, secrets: [SHOP_SECRET], fetchImpl });
    expect(result).toEqual(payload);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: SHOPIFY_URL, method: "POST", body: SHOPIFY_QUERY, headers: { "X-Shopify-Access-Token": SHOP_SECRET } });
  });

  it.each([
    // Look-alike Google addresses
    "https://oauth2.googleapis.com.evil.com/token",
    "https://evil.com/https://oauth2.googleapis.com/token",
    "https://oauth2xgoogleapis.com/token",
    "https://oauth2.googleapis.com/token/",
    "https://oauth2.googleapis.com/token?redirect=https://evil.com",
    "https://oauth2.googleapis.com/revoke",
    // GA4 look-alikes and other GA4 methods
    "https://analyticsdata.googleapis.com/v1beta/properties/abc:runReport",
    "https://analyticsdata.googleapis.com/v1beta/properties/:runReport",
    "https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports",
    "https://analyticsdata.googleapis.com/v1/properties/123456789:runReport",
    "https://analyticsdata.googleapis.com.evil.com/v1beta/properties/123456789:runReport",
    // Shopify look-alikes and REST write endpoints
    "https://test-farm-shop.myshopify.com.evil.com/admin/api/2024-10/graphql.json",
    "https://evil.com/test-farm-shop.myshopify.com/admin/api/2024-10/graphql.json",
    "https://test.farm.myshopify.com/admin/api/2024-10/graphql.json",
    "https://test-farm-shop.myshopify.com/admin/api/2024-10/products.json",
    "https://test-farm-shop.myshopify.com/admin/api/2024-10/graphql.json?x=1",
    // Channels that must never receive a POST
    "https://graph.facebook.com/v21.0/100000000000001/feed",
    "https://api.line.me/v2/bot/message/broadcast",
    "https://www.example-farm.test/wp-json/wc/v3/products/1",
  ])("blocks a POST to %s before fetch is called", async (url) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(url, { method: "POST", body: "{}", fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe("This request is not on the read-only list and was blocked.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    "http://oauth2.googleapis.com/token",
    "http://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport",
    "http://test-farm-shop.myshopify.com/admin/api/2024-10/graphql.json",
  ])("blocks a POST to the http:// version of an allowed address (%s)", async (url) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(url, { method: "POST", body: SHOPIFY_QUERY, fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    JSON.stringify({ query: 'mutation { productUpdate(input: { id: "gid://shopify/Product/1", title: "Changed" }) { product { id } } }' }),
    JSON.stringify({ query: "mutation{productDelete(input:{id:\"gid://shopify/Product/1\"}){deletedProductId}}" }),
    JSON.stringify({ query: "MUTATION { productUpdate(input: {}) { product { id } } }" }),
    JSON.stringify({ query: "Mutation PriceChange($input: ProductVariantInput!) { productVariantUpdate(input: $input) { productVariant { price } } }" }),
    JSON.stringify({ query: "query { shop { name } } mutation { tagsAdd(id: \"gid://shopify/Product/1\", tags: [\"x\"]) { userErrors { message } } }" }),
    "mutation { productUpdate(input: {}) { product { id } } }",
  ])("blocks a Shopify request whose body contains a mutation (%s)", async (body) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(SHOPIFY_URL, { method: "POST", body, fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a multi-line Shopify mutation sent as JSON", async () => {
    const body = JSON.stringify({
      query: `
mutation {
  productVariantUpdate(input: { id: "gid://shopify/ProductVariant/1", price: "1.00" }) { productVariant { id } }
}`,
    });
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ data: {} }));
    const error = await caught(readOnlyText(SHOPIFY_URL, { method: "POST", body, fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a Shopify mutation hidden with a JSON unicode escape", async () => {
    const body = '{"query":"\\u006dutation { productUpdate(input: {id: \\"gid://shopify/Product/1\\", title: \\"Changed\\"}) { product { id } } }"}';
    expect(JSON.parse(body).query.startsWith("mutation")).toBe(true);
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ data: {} }));
    const error = await caught(readOnlyText(SHOPIFY_URL, { method: "POST", body, fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("readOnlyText: redirects", () => {
  const PUBLIC_URL = "https://www.example.com/";
  const redirectTo = (status: number, location: string) => new Response(null, { status, headers: { Location: location } });

  it.each<[string, string, ReadOnlyRequest]>([
    ["a GET with secrets", GET_URL, { secrets: [TOKEN] }],
    ["a GET with an Authorization header", GET_URL, { headers: { Authorization: `Bearer ${TOKEN}` } }],
    ["a GET with a token header", GET_URL, { headers: { "X-Shopify-Access-Token": TOKEN } }],
    ["the Google sign-in POST", TOKEN_URL, { method: "POST", body: "grant_type=x&assertion=y" }],
    ["a Shopify GraphQL query", SHOPIFY_URL, { method: "POST", body: SHOPIFY_QUERY, headers: { "X-Shopify-Access-Token": TOKEN } }],
  ])("never follows redirects for %s, so a key or body cannot be carried to another address", async (_name, url, req) => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({}));
    await readOnlyText(url, { ...req, fetchImpl });
    expect(calls[0].redirect).toBe("manual");
  });

  it("lets a public GET with no key follow redirects (for example www to non-www)", async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response("ok"));
    await readOnlyText(PUBLIC_URL, { headers: { "User-Agent": "KPF-Marketing-Assist (read-only)" }, fetchImpl });
    expect(calls[0].redirect).toBe("follow");
  });

  it.each([301, 302, 303, 307, 308])("stops a signed-in request that is answered with a %i redirect, makes no second request, and hides the token", async (status) => {
    const { fetchImpl, calls } = recordingFetch(() => redirectTo(status, `https://evil.example.com/collect?t=${TOKEN}`));
    const error = await caught(readOnlyText(SHOPIFY_URL, { method: "POST", body: SHOPIFY_QUERY, headers: { "X-Shopify-Access-Token": TOKEN }, secrets: [TOKEN], fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe("The service tried to send this signed-in request to another address. It was stopped for safety.");
    expect(calls).toHaveLength(1);
    expectSecretHidden(error, TOKEN);
  });

  it("stops a signed-in request when the browser-style answer is an opaque redirect", async () => {
    const opaque = { type: "opaqueredirect", status: 0, ok: false, url: "", text: async () => "" } as unknown as Response;
    const { fetchImpl } = recordingFetch(() => opaque);
    const error = await caught(readOnlyText(GET_URL, { secrets: [TOKEN], fetchImpl }));
    expect(error.kind).toBe("blocked");
  });

  it("refuses a public GET that was redirected to a plain http address", async () => {
    const res = new Response("<html>insecure</html>");
    Object.defineProperty(res, "url", { value: "http://www.example.com/" });
    const { fetchImpl } = recordingFetch(() => res);
    const error = await caught(readOnlyText(PUBLIC_URL, { fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe("The service redirected to a non-secure (http) address, so it was not read.");
  });

  it("reads a public GET that was redirected to another https address", async () => {
    const res = new Response("hello");
    Object.defineProperty(res, "url", { value: "https://example.com/" });
    const { fetchImpl } = recordingFetch(() => res);
    await expect(readOnlyText(PUBLIC_URL, { fetchImpl })).resolves.toBe("hello");
  });
});

describe("isAllowedPost", () => {
  it.each<[string, string | undefined, boolean]>([
    [TOKEN_URL, "grant_type=x", true],
    [TOKEN_URL, undefined, true],
    [GA4_URL, "{}", true],
    ["https://analyticsdata.googleapis.com/v1beta/properties/1:runReport", "{}", true],
    [SHOPIFY_URL, SHOPIFY_QUERY, true],
    ["https://shop-2.myshopify.com/admin/api/2025-01/graphql.json", SHOPIFY_QUERY, true],
    // Shopify bodies must be JSON with a GraphQL query; anything else is refused.
    [SHOPIFY_URL, undefined, false],
    [SHOPIFY_URL, "not json", false],
    [SHOPIFY_URL, JSON.stringify({ variables: {} }), false],
    [SHOPIFY_URL, JSON.stringify({ query: "subscription { x }" }), false],
    // Conservative: the word "mutation" anywhere in the body is refused, even inside a comment.
    [SHOPIFY_URL, JSON.stringify({ query: "# mutation in a comment only\nquery { shop { name } }" }), false],
    [SHOPIFY_URL, JSON.stringify({ query: "query { shop { name } }", variables: { note: "immutable mutations" } }), true],
    [SHOPIFY_URL, JSON.stringify({ query: "mutation { x }" }), false],
    [SHOPIFY_URL, JSON.stringify({ query: "MuTaTiOn { x }" }), false],
    ["https://oauth2.googleapis.com.evil.com/token", "", false],
    ["http://oauth2.googleapis.com/token", "", false],
    ["https://analyticsdata.googleapis.com/v1beta/properties/abc:runReport", "{}", false],
    ["https://analyticsdata.googleapis.com/v1beta/properties/12a:runReport", "{}", false],
    ["https://Test-Farm-Shop.myshopify.com/admin/api/2024-10/graphql.json", SHOPIFY_QUERY, false],
    ["https://test-farm-shop.myshopify.com/admin/api/latest/graphql.json", SHOPIFY_QUERY, false],
    ["https://graph.facebook.com/v21.0/me/feed", "", false],
    ["", "", false],
  ])("%s with body %s -> %s", (url, body, expected) => {
    expect(isAllowedPost(url, body)).toBe(expected);
  });
});

describe("readOnlyText: non-https addresses", () => {
  it.each([
    "http://www.example-farm.test/",
    "ftp://files.example-farm.test/report",
    "file:///etc/passwd",
    "//www.example-farm.test/",
    " https://www.example-farm.test/",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "",
  ])("blocks %j before fetch is called", async (url) => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(url, { fetchImpl }));
    expect(error.kind).toBe("blocked");
    expect(error.message).toBe("Only secure (https) addresses are allowed.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not repeat the address (which may hold a token) in the blocked message", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const error = await caught(readOnlyText(`http://graph.facebook.com/v21.0/me?access_token=${TOKEN}`, { fetchImpl, secrets: [TOKEN] }));
    expect(error.kind).toBe("blocked");
    expectSecretHidden(error, TOKEN);
  });
});

describe("readOnlyText: HTTP status mapping", () => {
  it.each([
    [401, "auth"],
    [403, "permission"],
    [404, "not_found"],
    [429, "rate_limit"],
    [500, "bad_response"],
    [400, "bad_response"],
    [503, "bad_response"],
  ])("status %i -> kind %s", async (status, kind) => {
    const { fetchImpl, calls } = recordingFetch(() => new Response("Something failed", { status }));
    const error = await caught(readOnlyText(GET_URL, { fetchImpl }));
    expect(error.kind).toBe(kind);
    expect(error.message).toBe(`The service answered ${status}.`);
    expect(calls).toHaveLength(1);
  });

  it("readOnlyJson throws the same mapped error instead of trying to read the body", async () => {
    const { fetchImpl } = recordingFetch(() => new Response("not json at all", { status: 403 }));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("permission");
    expect(error.message).toBe("The service answered 403.");
  });

  it("includes error.message from a Google or Meta style error body", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190 } }, 401));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("auth");
    expect(error.message).toBe("The service answered 401: Invalid OAuth access token.");
  });

  it("includes message from a LINE style error body", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ message: "Authentication failed" }, 401));
    const error = await caught(readOnlyJson("https://api.line.me/v2/bot/info", { fetchImpl }));
    expect(error.message).toBe("The service answered 401: Authentication failed.");
  });

  it("includes error_description from an OAuth style error body", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ error: "invalid_grant", error_description: "Invalid JWT Signature" }, 400));
    const error = await caught(readOnlyJson(TOKEN_URL, { method: "POST", body: "grant_type=x", fetchImpl }));
    expect(error.kind).toBe("bad_response");
    expect(error.message).toBe("The service answered 400: Invalid JWT Signature.");
  });

  it("prefers error.message over message and error_description", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ error: { message: "first" }, message: "second", error_description: "third" }, 404));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("not_found");
    expect(error.message).toBe("The service answered 404: first.");
  });

  it("cuts a long error detail to 200 characters", async () => {
    const detail = "a".repeat(150) + "b".repeat(150);
    const { fetchImpl } = recordingFetch(() => jsonResponse({ error: { message: detail } }, 500));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.message).toBe(`The service answered 500: ${"a".repeat(150)}${"b".repeat(50)}.`);
  });

  it("leaves out the detail when the error body is JSON without a known message field", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ errors: [{ code: "X" }] }, 429));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("rate_limit");
    expect(error.message).toBe("The service answered 429.");
  });
});

describe("readOnlyText: timeouts and network errors", () => {
  it("turns a request that never answers into a timeout", async () => {
    const { fetchImpl, calls } = recordingFetch((_url, init) => waitForAbort(init));
    const error = await caught(readOnlyText(GET_URL, { fetchImpl, timeoutMs: 20 }));
    expect(error.kind).toBe("timeout");
    expect(error.message).toBe("The service did not answer in time.");
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it("uses an 8 second limit when no timeout is given", async () => {
    vi.useFakeTimers();
    const { fetchImpl, calls } = recordingFetch((_url, init) => waitForAbort(init));
    const pending = caught(readOnlyText(GET_URL, { fetchImpl }));
    await vi.advanceTimersByTimeAsync(7999);
    expect(calls[0].signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;
    expect(error.kind).toBe("timeout");
  });

  it("clears its timer once the service has answered", async () => {
    vi.useFakeTimers();
    const { fetchImpl } = recordingFetch(() => jsonResponse({ ok: true }));
    await readOnlyJson(GET_URL, { fetchImpl, timeoutMs: 50 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("turns a failed connection into a network error", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await caught(readOnlyText(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("network");
    expect(error.message).toBe("Could not reach the service: fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("handles a failure that is not an Error object", async () => {
    const fetchImpl = vi.fn<FetchLike>(() => Promise.reject("socket hang up"));
    const error = await caught(readOnlyText(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("network");
    expect(error.message).toBe("Could not reach the service: socket hang up");
  });

  it("also times out when the service sends headers but never finishes the body", async () => {
    const { fetchImpl } = recordingFetch(
      (_url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"partial":'));
              init?.signal?.addEventListener("abort", () => controller.error(new DOMException("This operation was aborted", "AbortError")));
            },
          }),
          { status: 200 },
        ),
    );
    const outcome = await Promise.race([
      readOnlyText(GET_URL, { fetchImpl, timeoutMs: 20 }).then(
        () => "finished",
        (error: unknown) => error,
      ),
      new Promise((resolve) => setTimeout(() => resolve("still waiting"), 300)),
    ]);
    expect(outcome).toBeInstanceOf(ChannelError);
    expect((outcome as ChannelError).kind).toBe("timeout");
  });
});

describe("readOnlyJson: unreadable answers", () => {
  it.each([["{not json"], [""], ["<html>Service Unavailable</html>"]])("a 200 answer of %j is a bad_response", async (text) => {
    const { fetchImpl } = recordingFetch(() => new Response(text, { status: 200 }));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl }));
    expect(error.kind).toBe("bad_response");
    expect(error.message).toBe("The service sent an answer that could not be read.");
  });

  it("readOnlyText still returns the same unreadable text as-is", async () => {
    const { fetchImpl } = recordingFetch(() => new Response("{not json", { status: 200 }));
    expect(await readOnlyText(GET_URL, { fetchImpl })).toBe("{not json");
  });
});

describe("redact", () => {
  it("replaces every occurrence of a secret", () => {
    expect(redact(`a ${TOKEN} b ${TOKEN}${TOKEN}`, [TOKEN])).toBe("a [redacted] b [redacted][redacted]");
  });

  it("replaces several different secrets", () => {
    const out = redact(`token=${TOKEN}&secret=${SHOP_SECRET}`, [TOKEN, SHOP_SECRET]);
    expect(out).toBe("token=[redacted]&secret=[redacted]");
  });

  it("ignores secrets shorter than 4 characters and empty secrets", () => {
    expect(redact("abc and abcd and x", ["abc", "x", "", "abcd"])).toBe("abc and [redacted] and x");
    expect(redact("plain text", [""])).toBe("plain text");
  });

  it("redacts a secret of exactly 4 characters", () => {
    expect(redact("pin 1a2b here", ["1a2b"])).toBe("pin [redacted] here");
  });

  it("returns the text unchanged when there are no secrets", () => {
    expect(redact("nothing secret")).toBe("nothing secret");
    expect(redact("nothing secret", [])).toBe("nothing secret");
  });
});

describe("readOnlyText: secrets never appear in errors", () => {
  it.each([
    ["error.message", { error: { message: `Invalid access token ${TOKEN} for this page` } }],
    ["message", { message: `The token ${TOKEN} is not valid` }],
    ["error_description", { error: "invalid_client", error_description: `client ${TOKEN} rejected` }],
  ])("hides a token echoed back in the %s field", async (_field, body) => {
    const { fetchImpl } = recordingFetch(() => jsonResponse(body, 401));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl, headers: { Authorization: `Bearer ${TOKEN}` }, secrets: [TOKEN] }));
    expect(error.kind).toBe("auth");
    expect(error.message).toContain("[redacted]");
    expectSecretHidden(error, TOKEN);
  });

  it("hides every secret when several are echoed back", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ errors: "x", message: `key ${TOKEN} secret ${SHOP_SECRET} key ${TOKEN}` }, 403));
    const error = await caught(readOnlyJson(SHOPIFY_URL, { method: "POST", body: SHOPIFY_QUERY, fetchImpl, secrets: [TOKEN, SHOP_SECRET] }));
    expect(error.kind).toBe("permission");
    expectSecretHidden(error, TOKEN);
    expectSecretHidden(error, SHOP_SECRET);
  });

  it("hides a token that appears in a network error message", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError(`request to https://graph.facebook.com/v21.0/me?access_token=${TOKEN} failed, reason: ECONNRESET`);
    });
    const error = await caught(readOnlyText(GET_URL, { fetchImpl, secrets: [TOKEN] }));
    expect(error.kind).toBe("network");
    expect(error.message).toContain("[redacted]");
    expectSecretHidden(error, TOKEN);
  });

  it("hides a secret that appears in a non-Error network failure", async () => {
    const fetchImpl = vi.fn<FetchLike>(() => Promise.reject(`proxy refused key ${SHOP_SECRET}`));
    const error = await caught(readOnlyText(GET_URL, { fetchImpl, secrets: [SHOP_SECRET] }));
    expectSecretHidden(error, SHOP_SECRET);
  });

  it("does not leak the start of a secret that is cut off by the 200-character limit", async () => {
    const detail = `${"x".repeat(190)}${TOKEN}`;
    const { fetchImpl } = recordingFetch(() => jsonResponse({ error: { message: detail } }, 401));
    const error = await caught(readOnlyJson(GET_URL, { fetchImpl, secrets: [TOKEN] }));
    expectSecretHidden(error, TOKEN);
    expect(error.message).not.toContain(TOKEN.slice(0, 10));
  });
});

describe("explain", () => {
  it.each([
    ["auth", "The access token was refused or has expired. Create a new one and update .env.local. (The service answered 401.)"],
    ["permission", "The token does not have permission to read this data. (The service answered 401.)"],
    ["not_found", "The account or page id was not found. Check the id in .env.local. (The service answered 401.)"],
    ["rate_limit", "The service asked us to slow down. Try again in a few minutes."],
    ["timeout", "The service answered 401."],
    ["network", "The service answered 401."],
    ["bad_response", "The service answered 401."],
    ["blocked", "The service answered 401."],
  ] as const)("explains kind %s in plain language", (kind, expected) => {
    expect(explain(new ChannelError("The service answered 401.", kind))).toBe(expected);
  });

  it("explains a real timeout with its own message", async () => {
    const { fetchImpl } = recordingFetch((_url, init) => waitForAbort(init));
    const error = await caught(readOnlyText(GET_URL, { fetchImpl, timeoutMs: 10 }));
    expect(explain(error)).toBe("The service did not answer in time.");
  });

  it.each([
    ["an Error", new Error(`boom ${TOKEN}`)],
    ["a string", `failed with ${TOKEN}`],
    ["undefined", undefined],
    ["null", null],
    ["a look-alike object", { name: "ChannelError", kind: "auth", message: TOKEN }],
  ])("gives a generic message for %s and does not repeat it", (_label, value) => {
    const text = explain(value);
    expect(text).toBe("Something went wrong while reading this channel.");
    expect(text).not.toContain(TOKEN);
  });

  it("ChannelError is a real Error with its own name and kind", () => {
    const error = new ChannelError("x", "blocked");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ChannelError");
    expect(error.kind).toBe("blocked");
  });
});
