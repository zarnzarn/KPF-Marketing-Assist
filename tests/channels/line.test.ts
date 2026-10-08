import { afterEach, describe, expect, it, vi } from "vitest";
import { lineSnapshot, lineStatsDate } from "@/lib/channels/line";
import type { FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic and shaped like the official LINE Messaging API answers.
// No real accounts or tokens. The network is never used: every test injects fetchImpl.

const TOKEN = "test-token-1234567890";
// 2026-10-06 10:00 in Thailand, so "yesterday" is 2026-10-05.
const NOW = new Date("2026-10-06T03:00:00.000Z");
const INFO_URL = "https://api.line.me/v2/bot/info";
const followersUrl = (date: string) => `https://api.line.me/v2/bot/insight/followers?date=${date}`;

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

const lineEnv = (extra: Record<string, string | undefined> = {}) => ({ LINE_CHANNEL_ACCESS_TOKEN: TOKEN, ...extra });

/** Asserts the exact secret is nowhere in what the browser would receive. */
function expectNoSecret(snapshot: ChannelSnapshot, secret: string = TOKEN) {
  expect(JSON.stringify(snapshot)).not.toContain(secret);
}

/** Asserts that only read-only GET requests were made. */
function expectOnlyGet(calls: RecordedCall[]) {
  for (const call of calls) {
    expect(call.method === "GET" || call.method === undefined).toBe(true);
    expect(call.body).toBeUndefined();
  }
}

const metric = (snap: ChannelSnapshot, label: string) => snap.metrics.find((m) => m.label === label);

// Shaped like GET /v2/bot/info
const botInfo = {
  userId: "U00000000000000000000000000000000",
  basicId: "@000synth",
  displayName: "Synthetic Farm OA",
  pictureUrl: "https://example.com/synthetic.png",
  chatMode: "chat",
  markAsReadMode: "manual",
};

// Shaped like GET /v2/bot/insight/followers
const readyStats = { status: "ready", followers: 12345, targetedReaches: 9876, blocks: 321 };

afterEach(() => {
  vi.useRealTimers();
});

describe("lineStatsDate", () => {
  it("returns yesterday in Thailand time as yyyyMMdd", () => {
    expect(lineStatsDate(NOW)).toBe("20261005");
  });

  it("still returns the day before while it is 23:59 in Thailand", () => {
    // 2026-10-06T16:59Z is 23:59 on 6 October in Thailand.
    expect(lineStatsDate(new Date("2026-10-06T16:59:00.000Z"))).toBe("20261005");
    expect(lineStatsDate(new Date("2026-10-06T16:59:59.999Z"))).toBe("20261005");
  });

  it("moves to the next day exactly at midnight in Thailand", () => {
    // 2026-10-06T17:00Z is 00:00 on 7 October in Thailand.
    expect(lineStatsDate(new Date("2026-10-06T17:00:00.000Z"))).toBe("20261006");
  });

  it("uses Thailand time, not UTC, early in the Thai morning", () => {
    // 2026-10-06T18:30Z is 01:30 on 7 October in Thailand, but still 6 October in UTC.
    expect(lineStatsDate(new Date("2026-10-06T18:30:00.000Z"))).toBe("20261006");
  });

  it("crosses a month boundary", () => {
    // 1 November in Thailand -> 31 October.
    expect(lineStatsDate(new Date("2026-10-31T17:00:00.000Z"))).toBe("20261031");
    // Still 31 October in Thailand -> 30 October.
    expect(lineStatsDate(new Date("2026-10-31T16:59:00.000Z"))).toBe("20261030");
    // 1 March in a normal year -> 28 February.
    expect(lineStatsDate(new Date("2026-03-01T05:00:00.000Z"))).toBe("20260228");
  });

  it("handles 29 February in a leap year", () => {
    expect(lineStatsDate(new Date("2028-03-01T05:00:00.000Z"))).toBe("20280229");
  });

  it("crosses a year boundary", () => {
    // 1 January 2027 00:00 in Thailand -> 31 December 2026.
    expect(lineStatsDate(new Date("2026-12-31T17:00:00.000Z"))).toBe("20261231");
    // 1 January 2026 07:30 in Thailand -> 31 December 2025.
    expect(lineStatsDate(new Date("2026-01-01T00:30:00.000Z"))).toBe("20251231");
    // Still 31 December in Thailand -> 30 December.
    expect(lineStatsDate(new Date("2026-12-31T16:59:00.000Z"))).toBe("20261230");
  });

  it("always returns eight digits", () => {
    expect(lineStatsDate(new Date("2026-02-02T05:00:00.000Z"))).toMatch(/^\d{8}$/);
    expect(lineStatsDate(new Date("2026-02-02T05:00:00.000Z"))).toBe("20260201");
  });
});

describe("lineSnapshot — not configured", () => {
  it("is not_configured and makes no request when LINE_CHANNEL_ACCESS_TOKEN is missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await lineSnapshot({ env: {}, fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.channel).toBe("line");
    expect(snap.label).toBe("LINE OA");
    expect(snap.status).toBe("not_configured");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.fetchedAt).toBeUndefined();
    expect(snap.message).toContain("LINE_CHANNEL_ACCESS_TOKEN");
    expect(snap.message).toContain(".env.local");
  });

  it("treats blank or quote-only values as missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    for (const value of ["", "   ", '""', "''"]) {
      const snap = await lineSnapshot({ env: { LINE_CHANNEL_ACCESS_TOKEN: value }, fetchImpl, now: NOW });
      expect(snap.status).toBe("not_configured");
    }
    expect(calls).toHaveLength(0);
  });

  it("ignores other channels' settings", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await lineSnapshot({ env: { META_PAGE_ACCESS_TOKEN: "fake-secret-abcdef" }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.status).toBe("not_configured");
    expectNoSecret(snap, "fake-secret-abcdef");
  });
});

describe("lineSnapshot — connected", () => {
  it("makes exactly two read-only GET calls: bot info, then followers for yesterday", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([INFO_URL, followersUrl("20261005")]);
    expectOnlyGet(calls);
  });

  it("asks for the Thai 'yesterday' date when the clock is just past midnight in Thailand", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    await lineSnapshot({ env: lineEnv(), fetchImpl, now: new Date("2026-10-06T17:00:00.000Z") });
    expect(calls[1].url).toBe(followersUrl("20261006"));
  });

  it("sends the token only as a Bearer Authorization header, never in the address", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    for (const call of calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(call.url).not.toContain(TOKEN);
    }
  });

  it("uses the token without the quotes or spaces from .env.local", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    await lineSnapshot({ env: lineEnv({ LINE_CHANNEL_ACCESS_TOKEN: ` "${TOKEN}" ` }), fetchImpl, now: NOW });
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('shows friends, targeted reach and blocks with thousands separators and an "as of" date', async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok(readyStats)]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.channel).toBe("line");
    expect(snap.label).toBe("LINE OA");
    expect(snap.status).toBe("connected");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toBeUndefined();
    expect(snap.items).toEqual([]);
    expect(snap.metrics).toEqual([
      { label: "Account", value: "Synthetic Farm OA" },
      { label: "Friends", value: "12,345", note: "as of 2026-10-05" },
      { label: "Targeted reach", value: "9,876" },
      { label: "Blocked", value: "321" },
    ]);
    expectNoSecret(snap);
  });

  it("shows zero counts as 0, not as missing", async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ status: "ready", followers: 0, targetedReaches: 0, blocks: 0 })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(metric(snap, "Friends")?.value).toBe("0");
    expect(metric(snap, "Targeted reach")?.value).toBe("0");
    expect(metric(snap, "Blocked")?.value).toBe("0");
  });

  it("dates the note with the day that was asked for, across a year boundary", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: new Date("2026-12-31T17:00:00.000Z") });
    expect(calls[1].url).toBe(followersUrl("20261231"));
    expect(metric(snap, "Friends")?.note).toBe("as of 2026-12-31");
  });

  it('says "Data not available." when a ready answer leaves out a number', async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ status: "ready", followers: 500 })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Friends")?.value).toBe("500");
    expect(metric(snap, "Targeted reach")?.value).toBe("Data not available.");
    expect(metric(snap, "Blocked")?.value).toBe("Data not available.");
  });

  it('does not invent numbers when LINE says the statistics are "unready"', async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ status: "unready" })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(metric(snap, "Account")?.value).toBe("Synthetic Farm OA");
    expect(metric(snap, "Friends")?.value).toBe("Data not available.");
    expect(metric(snap, "Friends")?.note).toBe("LINE has not prepared statistics for this day");
    expect(metric(snap, "Targeted reach")?.value).toBe("Data not available.");
    expect(metric(snap, "Blocked")?.value).toBe("Data not available.");
    expectNoSecret(snap);
  });

  it("ignores numbers sent alongside an unready status", async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ status: "unready", followers: 1, targetedReaches: 2, blocks: 3 })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(metric(snap, "Friends")?.value).toBe("Data not available.");
    expect(metric(snap, "Targeted reach")?.value).toBe("Data not available.");
    expect(metric(snap, "Blocked")?.value).toBe("Data not available.");
  });

  it('does not invent numbers when LINE says the date is "out_of_service"', async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ status: "out_of_service" })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Friends")?.value).toBe("Data not available.");
    expect(metric(snap, "Friends")?.note).toBe("LINE has not prepared statistics for this day");
    expect(metric(snap, "Friends")?.note).not.toMatch(/^as of/);
    expect(metric(snap, "Targeted reach")?.value).toBe("Data not available.");
    expect(metric(snap, "Blocked")?.value).toBe("Data not available.");
  });

  it("treats a followers answer without a status as not ready", async () => {
    const { fetchImpl } = recordingFetch([ok(botInfo), ok({ followers: 10, targetedReaches: 9, blocks: 1 })]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Friends")?.value).toBe("Data not available.");
  });

  it("falls back to the basic id (@...) when the account has no display name", async () => {
    const infoWithoutName: Partial<typeof botInfo> = { ...botInfo };
    delete infoWithoutName.displayName;
    const { fetchImpl } = recordingFetch([ok(infoWithoutName), ok(readyStats)]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(metric(snap, "Account")?.value).toBe("@000synth");
  });

  it('says "Data not available." for the account when neither name nor basic id is sent', async () => {
    const { fetchImpl } = recordingFetch([ok({ userId: "U00000000000000000000000000000000" }), ok(readyStats)]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Account")?.value).toBe("Data not available.");
  });

  it("uses the current time for fetchedAt and the stats date when no clock is injected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T05:00:00.000Z"));
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), ok(readyStats)]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl });
    expect(snap.fetchedAt).toBe("2026-03-01T05:00:00.000Z");
    expect(calls[1].url).toBe(followersUrl("20260228"));
    expect(metric(snap, "Friends")?.note).toBe("as of 2026-02-28");
  });
});

describe("lineSnapshot — errors", () => {
  it("explains a refused token (401) in plain language without showing the token", async () => {
    const { fetchImpl, calls } = recordingFetch([
      { status: 401, body: { message: "Authentication failed. Confirm that the access token in the authorization header is valid." } },
    ]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(1); // stops after the first failure
    expect(calls[0].url).toBe(INFO_URL);
    expectOnlyGet(calls);
    expect(snap.channel).toBe("line");
    expect(snap.status).toBe("error");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.message).toContain("The access token was refused or has expired");
    expect(snap.message).toContain(".env.local");
    expect(snap.message).toContain("401");
    expect(snap.message).toContain("Authentication failed");
    expect(snap.message).not.toMatch(/\{/);
    expectNoSecret(snap);
  });

  it("removes the token if the LINE error message repeats it", async () => {
    const { fetchImpl } = recordingFetch([{ status: 401, body: { message: `Invalid access token: ${TOKEN}` } }]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("[redacted]");
    expectNoSecret(snap);
  });

  it("returns an error (not half the data) when the followers call fails after the info call worked", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(botInfo), { status: 403, body: { message: "Not authorized to use this API." } }]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(2);
    expectOnlyGet(calls);
    expect(snap.status).toBe("error");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.message).toContain("The token does not have permission to read this data.");
    expect(JSON.stringify(snap)).not.toContain("Synthetic Farm OA");
    expectNoSecret(snap);
  });

  it("asks the user to wait when rate limited (429)", async () => {
    const { fetchImpl } = recordingFetch([{ status: 429, body: { message: "The API rate limit has been exceeded. Try again later." } }]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service asked us to slow down. Try again in a few minutes.");
  });

  it("explains an answer that is not JSON", async () => {
    const { fetchImpl } = recordingFetch([{ status: 200, body: "<html>not json</html>" }]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service sent an answer that could not be read.");
  });

  it("explains a server error (500) with LINE's own message", async () => {
    const { fetchImpl } = recordingFetch([{ status: 500, body: { message: "An error occurred in the API server." } }]);
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The service answered 500");
    expect(snap.message).toContain("An error occurred in the API server");
    expectNoSecret(snap);
  });

  it("explains a network failure without showing the token", async () => {
    const calls: RecordedCall[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, method: init?.method, headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body });
      throw new Error(`connect ECONNREFUSED while sending Bearer ${TOKEN}`);
    };
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(1);
    expectOnlyGet(calls);
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expect(snap.message).toContain("[redacted]");
    expectNoSecret(snap);
  });

  it("never throws, even when fetch rejects with something that is not an Error", async () => {
    const fetchImpl: FetchLike = async () => {
      throw `raw failure with ${TOKEN}`;
    };
    const snap = await lineSnapshot({ env: lineEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expectNoSecret(snap);
  });
});
