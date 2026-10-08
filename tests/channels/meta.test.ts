import { afterEach, describe, expect, it, vi } from "vitest";
import { GRAPH_VERSION, channelConfig, num, thaiDate } from "@/lib/channels/config";
import { facebookSnapshot, instagramSnapshot } from "@/lib/channels/meta";
import type { FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic and shaped like the official Graph API answers.
// No real page ids, accounts or tokens. The network is never used: every test injects fetchImpl.

const TOKEN = "test-token-1234567890";
const PAGE_ID = "100000000000001";
const IG_USER_ID = "17800000000000001";
const NOW = new Date("2026-10-06T03:00:00.000Z");
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

interface Reply {
  status: number;
  body: unknown;
}

/** A fake fetch that answers in order and records every call. */
function recordingFetch(replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`Unexpected extra request #${calls.length}`);
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, calls };
}

const ok = (body: unknown): Reply => ({ status: 200, body });

const metaEnv = (extra: Record<string, string | undefined> = {}) => ({
  META_PAGE_ID: PAGE_ID,
  META_PAGE_ACCESS_TOKEN: TOKEN,
  META_IG_USER_ID: IG_USER_ID,
  ...extra,
});

/** Asserts the exact secret is nowhere in what the browser would receive. */
function expectNoSecret(snapshot: ChannelSnapshot, secret: string = TOKEN) {
  expect(JSON.stringify(snapshot)).not.toContain(secret);
}

const fbPage = { name: "Synthetic Farm Page", followers_count: 12345, fan_count: 9876, id: PAGE_ID };
const fbPosts = {
  data: [
    {
      id: `${PAGE_ID}_1`,
      message: "Synthetic post one",
      created_time: "2026-10-05T20:00:00+0000",
      permalink_url: "https://www.facebook.com/example/posts/1",
    },
    { id: `${PAGE_ID}_2`, created_time: "2026-10-01T03:00:00+0000", permalink_url: "https://www.facebook.com/example/posts/2" },
  ],
  paging: { cursors: { before: "b", after: "a" } },
};

const igUser = { username: "synthetic_farm", followers_count: 4321, media_count: 210, id: IG_USER_ID };
const igMedia = {
  data: [
    {
      id: "18000000000000001",
      caption: "Synthetic caption",
      timestamp: "2026-10-04T18:30:00+0000",
      permalink: "https://www.instagram.com/p/SYNTHETIC1/",
      like_count: 1520,
      comments_count: 34,
    },
    { id: "18000000000000002", timestamp: "2026-10-02T01:00:00+0000", permalink: "https://www.instagram.com/p/SYNTHETIC2/", like_count: 7, comments_count: 0 },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("channelConfig", () => {
  it("reads the Meta settings from the given environment", () => {
    const config = channelConfig(metaEnv());
    expect(config.meta).toEqual({ pageId: PAGE_ID, token: TOKEN, igUserId: IG_USER_ID });
  });

  it("trims spaces around values", () => {
    const config = channelConfig({ META_PAGE_ID: `  ${PAGE_ID}\n`, META_PAGE_ACCESS_TOKEN: `\t${TOKEN}  ` });
    expect(config.meta.pageId).toBe(PAGE_ID);
    expect(config.meta.token).toBe(TOKEN);
  });

  it("strips surrounding double or single quotes", () => {
    const config = channelConfig({ META_PAGE_ID: `"${PAGE_ID}"`, META_PAGE_ACCESS_TOKEN: `'${TOKEN}'`, META_IG_USER_ID: ` "${IG_USER_ID}" ` });
    expect(config.meta).toEqual({ pageId: PAGE_ID, token: TOKEN, igUserId: IG_USER_ID });
  });

  it("keeps quotes that are inside a value", () => {
    expect(channelConfig({ META_PAGE_ID: `ab"cd` }).meta.pageId).toBe(`ab"cd`);
  });

  it("returns empty strings for missing, blank or quote-only values", () => {
    expect(channelConfig({}).meta).toEqual({ pageId: "", token: "", igUserId: "" });
    expect(channelConfig({ META_PAGE_ID: "   ", META_PAGE_ACCESS_TOKEN: '""', META_IG_USER_ID: "''" }).meta).toEqual({ pageId: "", token: "", igUserId: "" });
  });

  it("uses process.env when no environment is passed", () => {
    vi.stubEnv("META_PAGE_ID", "200000000000002");
    vi.stubEnv("META_PAGE_ACCESS_TOKEN", "fake-secret-abcdef");
    expect(channelConfig().meta.pageId).toBe("200000000000002");
    expect(channelConfig().meta.token).toBe("fake-secret-abcdef");
  });
});

describe("num", () => {
  it("formats whole numbers with thousands separators", () => {
    expect(num(0)).toBe("0");
    expect(num(999)).toBe("999");
    expect(num(12345)).toBe("12,345");
    expect(num(1234567)).toBe("1,234,567");
  });

  it('says "Data not available." for missing or non-numeric values', () => {
    expect(num(undefined)).toBe("Data not available.");
    expect(num(null)).toBe("Data not available.");
    expect(num("12345")).toBe("Data not available.");
    expect(num(Number.NaN)).toBe("Data not available.");
    expect(num(Number.POSITIVE_INFINITY)).toBe("Data not available.");
  });
});

describe("thaiDate", () => {
  it("converts a Graph API timestamp to the date in Thailand (UTC+7)", () => {
    expect(thaiDate("2026-10-05T20:00:00+0000")).toBe("2026-10-06");
    expect(thaiDate("2026-10-05T16:59:59+0000")).toBe("2026-10-05");
    expect(thaiDate("2026-10-05T17:00:00Z")).toBe("2026-10-06");
  });

  it("respects a time zone offset in the timestamp", () => {
    expect(thaiDate("2026-10-05T23:30:00+07:00")).toBe("2026-10-05");
  });

  it("returns undefined for missing or unreadable timestamps", () => {
    expect(thaiDate(undefined)).toBeUndefined();
    expect(thaiDate("")).toBeUndefined();
    expect(thaiDate("not a date")).toBeUndefined();
  });
});

describe("facebookSnapshot — not configured", () => {
  it("is not_configured and makes no request when META_PAGE_ID is missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await facebookSnapshot({ env: metaEnv({ META_PAGE_ID: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("not_configured");
    expect(snap.channel).toBe("facebook");
    expect(snap.label).toBe("Facebook");
    expect(snap.message).toContain("META_PAGE_ID");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(calls).toHaveLength(0);
    expectNoSecret(snap);
  });

  it("is not_configured and makes no request when META_PAGE_ACCESS_TOKEN is missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await facebookSnapshot({ env: metaEnv({ META_PAGE_ACCESS_TOKEN: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("not_configured");
    expect(snap.message).toContain("META_PAGE_ACCESS_TOKEN");
    expect(calls).toHaveLength(0);
  });

  it("treats blank or quote-only values as missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await facebookSnapshot({ env: { META_PAGE_ID: "   ", META_PAGE_ACCESS_TOKEN: '""' }, fetchImpl, now: NOW });
    expect(snap.status).toBe("not_configured");
    expect(calls).toHaveLength(0);
  });

  it("does not need an Instagram id", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    const snap = await facebookSnapshot({ env: metaEnv({ META_IG_USER_ID: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(calls).toHaveLength(2);
  });
});

describe("facebookSnapshot — connected", () => {
  it("makes exactly two read-only GET calls to the Graph API", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([
      `${GRAPH}/${PAGE_ID}?fields=name,followers_count,fan_count`,
      `${GRAPH}/${PAGE_ID}/posts?fields=message,created_time,permalink_url&limit=5`,
    ]);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      expect(call.body).toBeUndefined();
    }
  });

  it("sends the token only in the Authorization header, never in the address", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    for (const call of calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(call.url).not.toContain(TOKEN);
      expect(call.url).not.toContain("access_token");
    }
  });

  it("uses the token without the quotes from .env.local", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    await facebookSnapshot({ env: metaEnv({ META_PAGE_ID: ` "${PAGE_ID}" `, META_PAGE_ACCESS_TOKEN: `"${TOKEN}"` }), fetchImpl, now: NOW });
    expect(calls[0].url).toBe(`${GRAPH}/${PAGE_ID}?fields=name,followers_count,fan_count`);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("URL-encodes a page id with special characters", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    await facebookSnapshot({ env: metaEnv({ META_PAGE_ID: "12/../me?x=1&y#z" }), fetchImpl, now: NOW });
    expect(calls[0].url).toBe(`${GRAPH}/12%2F..%2Fme%3Fx%3D1%26y%23z?fields=name,followers_count,fan_count`);
    expect(calls[1].url).toBe(`${GRAPH}/12%2F..%2Fme%3Fx%3D1%26y%23z/posts?fields=message,created_time,permalink_url&limit=5`);
  });

  it("shows page name, followers and page likes with thousands separators", async () => {
    const { fetchImpl } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.channel).toBe("facebook");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toBeUndefined();
    expect(snap.metrics).toEqual([
      { label: "Page", value: "Synthetic Farm Page" },
      { label: "Followers", value: "12,345" },
      { label: "Page likes", value: "9,876" },
    ]);
    expectNoSecret(snap);
  });

  it("lists recent posts with Thai dates and links", async () => {
    const { fetchImpl } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.items).toEqual([
      { id: `${PAGE_ID}_1`, title: "Synthetic post one", date: "2026-10-06", url: "https://www.facebook.com/example/posts/1" },
      { id: `${PAGE_ID}_2`, title: "(post without text)", date: "2026-10-01", url: "https://www.facebook.com/example/posts/2" },
    ]);
  });

  it("cuts long post text to 160 characters", async () => {
    const long = "ไก่".repeat(100) + "x".repeat(100);
    const { fetchImpl } = recordingFetch([ok(fbPage), ok({ data: [{ id: "p1", message: long, created_time: "2026-10-05T01:00:00+0000" }] })]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.items[0].title).toHaveLength(160);
    expect(snap.items[0].title).toBe(long.slice(0, 160));
  });

  it("keeps a post of exactly 160 characters whole", async () => {
    const exact = "a".repeat(160);
    const { fetchImpl } = recordingFetch([ok(fbPage), ok({ data: [{ id: "p1", message: exact }] })]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.items[0].title).toBe(exact);
    expect(snap.items[0].date).toBeUndefined();
    expect(snap.items[0].url).toBeUndefined();
  });

  it('says "Data not available." when the page leaves out its name or numbers', async () => {
    const { fetchImpl } = recordingFetch([ok({ id: PAGE_ID }), ok({ data: [] })]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.metrics).toEqual([
      { label: "Page", value: "Data not available." },
      { label: "Followers", value: "Data not available." },
      { label: "Page likes", value: "Data not available." },
    ]);
    expect(snap.items).toEqual([]);
  });

  it("returns no posts (and invents none) when the posts answer has no data list", async () => {
    const { fetchImpl } = recordingFetch([ok(fbPage), ok({})]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.items).toEqual([]);
  });

  it("uses the current time for fetchedAt when no clock is injected", async () => {
    const { fetchImpl } = recordingFetch([ok(fbPage), ok(fbPosts)]);
    const before = Date.now();
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl });
    const fetched = Date.parse(snap.fetchedAt ?? "");
    expect(fetched).toBeGreaterThanOrEqual(before - 1000);
    expect(fetched).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("facebookSnapshot — errors", () => {
  it("explains an invalid token (Graph error 400, code 190) without showing the token", async () => {
    const { fetchImpl, calls } = recordingFetch([
      { status: 400, body: { error: { message: "Error validating access token", type: "OAuthException", code: 190, fbtrace_id: "SYNTHETIC" } } },
    ]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.message).toContain("Error validating access token");
    expect(snap.message).not.toMatch(/OAuthException|fbtrace|\{/);
    expect(calls).toHaveLength(1); // stops after the first failure
    expectNoSecret(snap);
  });

  it("tells the user to renew the token when the Graph API answers 400 with code 190", async () => {
    const { fetchImpl } = recordingFetch([{ status: 400, body: { error: { message: "Error validating access token", type: "OAuthException", code: 190 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.message).toContain("The access token was refused or has expired");
  });

  it("explains a refused token (401) in plain language without showing the token", async () => {
    const { fetchImpl } = recordingFetch([{ status: 401, body: { error: { message: "Error validating access token", code: 190 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The access token was refused or has expired");
    expect(snap.message).toContain(".env.local");
    expect(snap.message).toContain("401");
    expectNoSecret(snap);
  });

  it("removes the token if the Graph error message repeats it", async () => {
    const { fetchImpl } = recordingFetch([{ status: 401, body: { error: { message: `Invalid OAuth access token ${TOKEN}`, code: 190 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("[redacted]");
    expectNoSecret(snap);
  });

  it("does not leak part of the token when a long error message is cut", async () => {
    const longToken = "fake-secret-abcdef-0123456789-ABCDEFGHIJ";
    const message = `${"x".repeat(180)} ${longToken}`;
    const { fetchImpl } = recordingFetch([{ status: 401, body: { error: { message, code: 190 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv({ META_PAGE_ACCESS_TOKEN: longToken }), fetchImpl, now: NOW });
    expectNoSecret(snap, longToken);
    expect(JSON.stringify(snap)).not.toContain(longToken.slice(0, 12));
  });

  it("explains a missing permission (403)", async () => {
    const { fetchImpl } = recordingFetch([
      { status: 403, body: { error: { message: "(#10) This endpoint requires the 'pages_read_engagement' permission", code: 10 } } },
    ]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The token does not have permission to read this data.");
    expect(snap.message).toContain("pages_read_engagement");
    expectNoSecret(snap);
  });

  it("explains an unknown page id (404)", async () => {
    const { fetchImpl } = recordingFetch([{ status: 404, body: { error: { message: "Unsupported get request.", code: 100 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The account or page id was not found");
  });

  it("asks the user to wait when rate limited (429)", async () => {
    const { fetchImpl } = recordingFetch([{ status: 429, body: { error: { message: "(#4) Application request limit reached", code: 4 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service asked us to slow down. Try again in a few minutes.");
  });

  it("returns an error (not half the data) when the posts call fails after the page call worked", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(fbPage), { status: 403, body: { error: { message: "(#200) Permissions error", code: 200 } } }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(2);
    expect(snap.status).toBe("error");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expectNoSecret(snap);
  });

  it("explains an answer that is not JSON", async () => {
    const { fetchImpl } = recordingFetch([{ status: 200, body: "<html>not json</html>" }]);
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service sent an answer that could not be read.");
  });

  it("explains a network failure without showing the token", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      throw new Error(`connect ECONNREFUSED while sending Bearer ${TOKEN}`);
    };
    const snap = await facebookSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(1);
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expectNoSecret(snap);
  });
});

describe("instagramSnapshot — not configured", () => {
  it("is not_configured and makes no request when META_IG_USER_ID is missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await instagramSnapshot({ env: metaEnv({ META_IG_USER_ID: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("not_configured");
    expect(snap.channel).toBe("instagram");
    expect(snap.label).toBe("Instagram");
    expect(snap.message).toContain("META_IG_USER_ID");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(calls).toHaveLength(0);
    expectNoSecret(snap);
  });

  it("is not_configured and makes no request when META_PAGE_ACCESS_TOKEN is missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await instagramSnapshot({ env: metaEnv({ META_PAGE_ACCESS_TOKEN: "" }), fetchImpl, now: NOW });
    expect(snap.status).toBe("not_configured");
    expect(snap.message).toContain("META_PAGE_ACCESS_TOKEN");
    expect(calls).toHaveLength(0);
  });

  it("does not need a Facebook page id", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(igUser), ok(igMedia)]);
    const snap = await instagramSnapshot({ env: metaEnv({ META_PAGE_ID: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(calls).toHaveLength(2);
  });
});

describe("instagramSnapshot — connected", () => {
  it("makes exactly two read-only GET calls with the token only in the header", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(igUser), ok(igMedia)]);
    await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([
      `${GRAPH}/${IG_USER_ID}?fields=username,followers_count,media_count`,
      `${GRAPH}/${IG_USER_ID}/media?fields=caption,timestamp,permalink,like_count,comments_count&limit=5`,
    ]);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      expect(call.body).toBeUndefined();
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(call.url).not.toContain(TOKEN);
      expect(call.url).not.toContain("access_token");
    }
  });

  it("URL-encodes an Instagram user id with special characters", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(igUser), ok(igMedia)]);
    await instagramSnapshot({ env: metaEnv({ META_IG_USER_ID: "17 8/me" }), fetchImpl, now: NOW });
    expect(calls[0].url).toBe(`${GRAPH}/17%208%2Fme?fields=username,followers_count,media_count`);
    expect(calls[1].url).toBe(`${GRAPH}/17%208%2Fme/media?fields=caption,timestamp,permalink,like_count,comments_count&limit=5`);
  });

  it("shows the account as @username with followers and post counts", async () => {
    const { fetchImpl } = recordingFetch([ok(igUser), ok(igMedia)]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.metrics).toEqual([
      { label: "Account", value: "@synthetic_farm" },
      { label: "Followers", value: "4,321" },
      { label: "Posts", value: "210" },
    ]);
    expectNoSecret(snap);
  });

  it("lists recent media with Thai dates, links and like/comment counts", async () => {
    const { fetchImpl } = recordingFetch([ok(igUser), ok(igMedia)]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.items).toEqual([
      {
        id: "18000000000000001",
        title: "Synthetic caption",
        date: "2026-10-05",
        url: "https://www.instagram.com/p/SYNTHETIC1/",
        detail: "Likes: 1,520 · Comments: 34",
      },
      {
        id: "18000000000000002",
        title: "(post without caption)",
        date: "2026-10-02",
        url: "https://www.instagram.com/p/SYNTHETIC2/",
        detail: "Likes: 7 · Comments: 0",
      },
    ]);
  });

  it("cuts long captions to 160 characters", async () => {
    const long = "ไข่ไก่".repeat(60);
    const { fetchImpl } = recordingFetch([ok(igUser), ok({ data: [{ id: "m1", caption: long, like_count: 1, comments_count: 1 }] })]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.items[0].title).toBe(long.slice(0, 160));
    expect(snap.items[0].title).toHaveLength(160);
  });

  it('says "Data not available." instead of inventing missing numbers', async () => {
    const { fetchImpl } = recordingFetch([ok({ id: IG_USER_ID }), ok({ data: [{ id: "m1", caption: "Hidden likes" }] })]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.metrics).toEqual([
      { label: "Account", value: "Data not available." },
      { label: "Followers", value: "Data not available." },
      { label: "Posts", value: "Data not available." },
    ]);
    expect(snap.items[0].detail).toBe("Likes: Data not available. · Comments: Data not available.");
    expect(snap.items[0].detail).not.toMatch(/\b0 likes/);
    expect(snap.items[0].date).toBeUndefined();
  });

  it("returns no media when the media answer has no data list", async () => {
    const { fetchImpl } = recordingFetch([ok(igUser), ok({})]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.items).toEqual([]);
  });
});

describe("instagramSnapshot — errors", () => {
  it("explains an invalid token (400, code 190) without showing the token", async () => {
    const { fetchImpl, calls } = recordingFetch([{ status: 400, body: { error: { message: "Error validating access token", type: "OAuthException", code: 190 } } }]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(1);
    expect(snap.status).toBe("error");
    expect(snap.channel).toBe("instagram");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toContain("Error validating access token");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expectNoSecret(snap);
  });

  it("explains a refused token (401) in plain language without showing the token", async () => {
    const { fetchImpl } = recordingFetch([{ status: 401, body: { error: { message: `Bad token ${TOKEN}`, code: 190 } } }]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The access token was refused or has expired");
    expectNoSecret(snap);
  });

  it("explains a missing permission (403)", async () => {
    const { fetchImpl } = recordingFetch([
      ok(igUser),
      { status: 403, body: { error: { message: "(#10) Application does not have permission for this action", code: 10 } } },
    ]);
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The token does not have permission to read this data.");
    expect(snap.metrics).toEqual([]);
    expectNoSecret(snap);
  });

  it("explains a network failure without showing the token", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error(`socket hang up (token ${TOKEN})`);
    };
    const snap = await instagramSnapshot({ env: metaEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expectNoSecret(snap);
  });
});
