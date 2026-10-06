// @vitest-environment node
// The GA4 adapter is server-only code (node:crypto, Buffer), so it is tested in Node.
import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ga4Snapshot, serviceAccountJwt } from "@/lib/channels/ga4";
import { isAllowedPost, type FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic and shaped like the official Google answers (OAuth token endpoint and
// GA4 Data API runReport). The RSA key pair is generated fresh for this test run and is not a real
// service-account key. The network is never used: every test injects fetchImpl and readFile.

const keyPair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
const { publicKey: PUBLIC_KEY, privateKey: PRIVATE_KEY } = keyPair();

const CLIENT_EMAIL = "synthetic-reader@synthetic-project-000000.iam.gserviceaccount.com";
const PROPERTY_ID = "123456789";
const KEY_PATH = "/nonexistent/outside-project/synthetic-ga4-key.json";
const ACCESS_TOKEN = "fake-access-token-xyz";
const NOW = new Date("2026-10-06T03:00:00.000Z");
const IAT = Math.floor(NOW.getTime() / 1000);

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORT_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
const NOT_AVAILABLE = "Data not available.";

/** The base64 lines inside the PEM, so a partly leaked key is noticed too (not only the whole key). */
const PEM_BODY_LINES = PRIVATE_KEY.split("\n").filter((line) => line.length >= 32 && !line.startsWith("-----"));

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: string | undefined;
}

type Reply = { status: number; body: unknown } | { error: unknown };

/** A fake fetch that answers in order and records every call. */
function recordingFetch(replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body as string | undefined });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`Unexpected extra request #${calls.length}`);
    if ("error" in reply) throw reply.error;
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, calls };
}

const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (status: number, body: unknown): Reply => ({ status, body });

const ga4Env = (extra: Record<string, string | undefined> = {}) => ({
  GA4_PROPERTY_ID: PROPERTY_ID,
  GA4_SERVICE_ACCOUNT_JSON_PATH: KEY_PATH,
  ...extra,
});

/** A synthetic service-account key file, shaped like the JSON Google lets you download. */
const keyFile = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "service_account",
    project_id: "synthetic-project-000000",
    private_key_id: "fake-key-id-0000000000",
    private_key: PRIVATE_KEY,
    client_email: CLIENT_EMAIL,
    token_uri: TOKEN_URL,
    ...overrides,
  });

const fakeReadFile = (content: string = keyFile()) => vi.fn(async (): Promise<string> => content);

const tokenReply = ok({ access_token: ACCESS_TOKEN, expires_in: 3599, token_type: "Bearer" });

const totalsReport = {
  metricHeaders: [
    { name: "activeUsers", type: "TYPE_INTEGER" },
    { name: "newUsers", type: "TYPE_INTEGER" },
    { name: "sessions", type: "TYPE_INTEGER" },
    { name: "averageSessionDuration", type: "TYPE_SECONDS" },
  ],
  rows: [{ metricValues: [{ value: "12345" }, { value: "6789" }, { value: "23456" }, { value: "114.6" }] }],
  rowCount: 1,
  metadata: { currencyCode: "THB", timeZone: "Asia/Bangkok" },
  kind: "analyticsData#runReport",
};

const sourcesReport = {
  dimensionHeaders: [{ name: "sessionSource" }],
  metricHeaders: [{ name: "sessions", type: "TYPE_INTEGER" }],
  rows: [
    { dimensionValues: [{ value: "google" }], metricValues: [{ value: "9876" }] },
    { dimensionValues: [{ value: "(direct)" }], metricValues: [{ value: "5432" }] },
    { dimensionValues: [{ value: "facebook.com" }], metricValues: [{ value: "1234" }] },
    { dimensionValues: [{ value: "line.me" }], metricValues: [{ value: "567" }] },
    { dimensionValues: [{ value: "instagram.com" }], metricValues: [{ value: "89" }] },
  ],
  rowCount: 12,
  metadata: { currencyCode: "THB", timeZone: "Asia/Bangkok" },
  kind: "analyticsData#runReport",
};

/** A totals report with one row of the given metric values (as GA4 sends them: strings). */
const totalsWith = (values: string[]) => ({ ...totalsReport, rows: [{ metricValues: values.map((value) => ({ value })) }] });

/** Runs the adapter with synthetic deps and returns the snapshot plus the recorded requests. */
async function run(replies: Reply[], options: { env?: Record<string, string | undefined>; readFile?: (path: string) => Promise<string>; now?: Date } = {}) {
  const { fetchImpl, calls } = recordingFetch(replies);
  const readFile = options.readFile ?? fakeReadFile();
  const snapshot = await ga4Snapshot({ env: options.env ?? ga4Env(), fetchImpl, readFile, now: "now" in options ? options.now : NOW });
  return { snapshot, calls, readFile };
}

const decodePart = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

/** True when the signature of a JWT checks out against the public key. */
function signatureValid(jwt: string, publicKey: string = PUBLIC_KEY): boolean {
  const [header, claims, signature] = jwt.split(".");
  return verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, "base64url"));
}

/** The JWT the adapter sent to Google's token address. */
const sentAssertion = (calls: RecordedCall[]) => new URLSearchParams(calls[0].body).get("assertion") ?? "";

/**
 * Asserts the exact secrets are nowhere in what the browser would receive. The private key has line breaks,
 * so its JSON-escaped form and each line of its body are checked as well.
 */
function expectNoSecrets(snapshot: ChannelSnapshot, extra: string[] = []) {
  const text = JSON.stringify(snapshot);
  for (const secret of [ACCESS_TOKEN, PRIVATE_KEY, ...extra].filter(Boolean)) {
    expect(text).not.toContain(secret);
    expect(text).not.toContain(JSON.stringify(secret).slice(1, -1));
    expect(snapshot.message ?? "").not.toContain(secret);
  }
  for (const line of PEM_BODY_LINES) expect(text).not.toContain(line);
}

describe("serviceAccountJwt", () => {
  it("returns header.claims.signature as three non-empty parts", () => {
    const parts = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW).split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(part.length).toBeGreaterThan(0);
  });

  it("uses an RS256 JWT header", () => {
    const [header] = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW).split(".");
    expect(decodePart(header)).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("asks only for the read-only analytics scope, for the service account, at Google's token address", () => {
    const [, claims] = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW).split(".");
    expect(decodePart(claims)).toEqual({ iss: CLIENT_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: IAT, exp: IAT + 3600 });
  });

  it("sets the issue time in whole seconds and expires exactly one hour later", () => {
    const now = new Date("2026-10-06T03:00:00.999Z");
    const claims = decodePart(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, now).split(".")[1]);
    expect(claims.iat).toBe(Math.floor(now.getTime() / 1000));
    expect(Number.isInteger(claims.iat)).toBe(true);
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("is signed with the private key so the matching public key verifies it", () => {
    expect(signatureValid(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW))).toBe(true);
  });

  it("does not verify when the claims are changed after signing", () => {
    const [header, , signature] = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW).split(".");
    const forged = Buffer.from(JSON.stringify({ iss: CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/analytics.edit", aud: TOKEN_URL, iat: IAT, exp: IAT + 3600 })).toString("base64url");
    expect(signatureValid(`${header}.${forged}.${signature}`)).toBe(false);
  });

  it("does not verify with somebody else's public key", () => {
    const other = keyPair();
    expect(signatureValid(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW), other.publicKey)).toBe(false);
  });

  it("uses only URL-safe base64 characters with no '=', '+' or '/'", () => {
    let standardNeededChanges = false;
    for (let i = 0; i < 8; i++) {
      const email = `reader${"x".repeat(i)}@synthetic-project-000000.iam.gserviceaccount.com`;
      const jwt = serviceAccountJwt(email, PRIVATE_KEY, new Date(NOW.getTime() + i * 1000));
      for (const part of jwt.split(".")) {
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(part).not.toMatch(/[=+/]/);
        expect(Buffer.from(part, "base64url").toString("base64url")).toBe(part);
        if (/[=+/]/.test(Buffer.from(part, "base64url").toString("base64"))) standardNeededChanges = true;
      }
    }
    // Plain base64 of these parts would contain '=', '+' or '/', so the URL-safe conversion was really exercised.
    expect(standardNeededChanges).toBe(true);
  });

  it("gives the same JWT for the same key, account and time", () => {
    expect(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW)).toBe(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW));
  });

  it("throws, without repeating the key, when the private key is not a real key", () => {
    const badKey = "fake-secret-abcdef-not-a-pem-key";
    let message = "";
    try {
      serviceAccountJwt(CLIENT_EMAIL, badKey, NOW);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(badKey);
  });
});

describe("ga4Snapshot: not configured", () => {
  it.each([
    ["the property id is missing", { GA4_PROPERTY_ID: undefined }],
    ["the key file path is missing", { GA4_SERVICE_ACCOUNT_JSON_PATH: undefined }],
    ["both are missing", { GA4_PROPERTY_ID: undefined, GA4_SERVICE_ACCOUNT_JSON_PATH: undefined }],
    ["the property id is blank", { GA4_PROPERTY_ID: "   " }],
    ["the key file path is only quotes", { GA4_SERVICE_ACCOUNT_JSON_PATH: '""' }],
  ])("is not_configured when %s, and reads nothing", async (_name, extra) => {
    const { snapshot, calls, readFile } = await run([], { env: ga4Env(extra) });
    expect(snapshot.status).toBe("not_configured");
    expect(snapshot.channel).toBe("ga4");
    expect(snapshot.label).toBe("Website traffic (GA4)");
    expect(snapshot.message).toContain("GA4_PROPERTY_ID");
    expect(snapshot.message).toContain("GA4_SERVICE_ACCOUNT_JSON_PATH");
    expect(snapshot.fetchedAt).toBeUndefined();
    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.items).toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("is not_configured for an empty environment", async () => {
    const { snapshot, calls } = await run([], { env: {} });
    expect(snapshot.status).toBe("not_configured");
    expect(calls).toHaveLength(0);
  });
});

describe("ga4Snapshot: key file", () => {
  it("reads the key file through deps.readFile with the cleaned-up path from the environment", async () => {
    const readFile = fakeReadFile();
    const { snapshot } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)], { env: ga4Env({ GA4_SERVICE_ACCOUNT_JSON_PATH: `  "${KEY_PATH}" ` }), readFile });
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith(KEY_PATH);
    // The path does not exist on disk, so a connected result proves the disk was never used.
    expect(snapshot.status).toBe("connected");
  });

  it("reports an error when the key file cannot be read, and makes no request", async () => {
    const readFile = vi.fn(async (path: string): Promise<string> => {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    });
    const { snapshot, calls } = await run([], { readFile });
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("could not be read");
    expect(snapshot.message).toContain("GA4_SERVICE_ACCOUNT_JSON_PATH");
    expect(snapshot.fetchedAt).toBe(NOW.toISOString());
    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.items).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it.each([["{not json"], [""], ["client_email=x\nprivate_key=y"], [keyFile().slice(0, 120)]])("reports an error for a key file that is not valid JSON (%#)", async (content) => {
    const { snapshot, calls } = await run([], { readFile: fakeReadFile(content) });
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("could not be read");
    expect(calls).toHaveLength(0);
    expectNoSecrets(snapshot);
  });

  it.each([
    ["client_email is missing", { client_email: undefined }],
    ["private_key is missing", { private_key: undefined }],
    ["both are missing", { client_email: undefined, private_key: undefined }],
    ["client_email is empty", { client_email: "" }],
    ["private_key is empty", { private_key: "" }],
  ])("reports an error when %s, and makes no request", async (_name, overrides) => {
    const { snapshot, calls } = await run([], { readFile: fakeReadFile(keyFile(overrides)) });
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("The GA4 key file is not a service-account key (client_email or private_key is missing).");
    expect(snapshot.fetchedAt).toBe(NOW.toISOString());
    expect(calls).toHaveLength(0);
    expectNoSecrets(snapshot);
  });

  it.each([["[]"], ["42"], ['"just text"'], ["{}"]])("reports a missing-key error for JSON that is not a key object: %s", async (content) => {
    const { snapshot, calls } = await run([], { readFile: fakeReadFile(content) });
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("client_email or private_key is missing");
    expect(calls).toHaveLength(0);
  });

  it("returns an error snapshot (does not throw) when the key file contains JSON null", async () => {
    const { snapshot, calls } = await run([], { readFile: fakeReadFile("null") });
    expect(snapshot.status).toBe("error");
    expect(calls).toHaveLength(0);
  });

  it("reports a plain error, without repeating the key, when private_key is not a real key", async () => {
    const badKey = "fake-secret-abcdef-not-a-pem-key";
    const { snapshot, calls } = await run([], { readFile: fakeReadFile(keyFile({ private_key: badKey })) });
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("Something went wrong while reading this channel.");
    expect(calls).toHaveLength(0);
    expectNoSecrets(snapshot, [badKey]);
  });

  it("uses the current time when deps.now is not given", async () => {
    const before = Date.now();
    const { snapshot } = await run([], { readFile: fakeReadFile("{not json"), now: undefined });
    const after = Date.now();
    const at = Date.parse(snapshot.fetchedAt ?? "");
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
  });
});

describe("ga4Snapshot: success", () => {
  it("asks Google's token address for an access token with a signed JWT (form body, POST)", async () => {
    const { calls } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    const call = calls[0];
    expect(call.url).toBe(TOKEN_URL);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    const form = new URLSearchParams(call.body);
    expect([...form.keys()].sort()).toEqual(["assertion", "grant_type"]);
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

    const assertion = sentAssertion(calls);
    expect(assertion).toBe(serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW));
    expect(signatureValid(assertion)).toBe(true);
    expect(decodePart(assertion.split(".")[1])).toEqual({ iss: CLIENT_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: IAT, exp: IAT + 3600 });
  });

  it("runs the Thailand totals report for the last 28 days with the access token", async () => {
    const { calls } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    const call = calls[1];
    expect(call.url).toBe(REPORT_URL);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" });
    expect(JSON.parse(call.body ?? "")).toEqual({
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "averageSessionDuration" }],
      dimensionFilter: { filter: { fieldName: "country", stringFilter: { value: "Thailand" } } },
    });
  });

  it("runs the Thailand top-5 traffic sources report, ordered by sessions (highest first)", async () => {
    const { calls } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    const call = calls[2];
    expect(call.url).toBe(REPORT_URL);
    expect(call.method).toBe("POST");
    expect(call.headers).toEqual({ Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" });
    expect(JSON.parse(call.body ?? "")).toEqual({
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: { filter: { fieldName: "country", stringFilter: { value: "Thailand" } } },
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    });
  });

  it("makes exactly three requests, all of them on the read-only list", async () => {
    const { calls } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    expect(calls.map((c) => c.url)).toEqual([TOKEN_URL, REPORT_URL, REPORT_URL]);
    for (const call of calls) {
      expect(call.method).toBe("POST");
      expect(isAllowedPost(call.url, call.body)).toBe(true);
    }
  });

  it("builds the connected snapshot from the two reports", async () => {
    const { snapshot } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    expect(snapshot).toEqual({
      channel: "ga4",
      label: "Website traffic (GA4)",
      status: "connected",
      fetchedAt: NOW.toISOString(),
      metrics: [
        { label: "Active users", value: "12,345", note: "Thailand, last 28 days" },
        { label: "New users", value: "6,789" },
        { label: "Sessions", value: "23,456" },
        { label: "Avg. session", value: "1m 55s" },
      ],
      items: [
        { id: "src-0", title: "google", detail: "9,876 sessions" },
        { id: "src-1", title: "(direct)", detail: "5,432 sessions" },
        { id: "src-2", title: "facebook.com", detail: "1,234 sessions" },
        { id: "src-3", title: "line.me", detail: "567 sessions" },
        { id: "src-4", title: "instagram.com", detail: "89 sessions" },
      ],
    });
  });

  it("never puts the access token, private key or JWT in the snapshot", async () => {
    const { snapshot, calls } = await run([tokenReply, ok(totalsReport), ok(sourcesReport)]);
    expect(snapshot.status).toBe("connected");
    expectNoSecrets(snapshot, [sentAssertion(calls), sentAssertion(calls).split(".")[2]]);
  });

  it.each([
    ["114.6", "1m 55s"],
    ["0", "0m 0s"],
    ["59.4", "0m 59s"],
    ["60", "1m 0s"],
    ["3725", "62m 5s"],
  ])("shows an average session of %s seconds as %s", async (seconds, expected) => {
    const { snapshot } = await run([tokenReply, ok(totalsWith(["1", "1", "1", seconds])), ok(sourcesReport)]);
    expect(snapshot.metrics.find((m) => m.label === "Avg. session")?.value).toBe(expected);
  });

  it("never shows 60 seconds in the average session (119.6 seconds is 2m 0s)", async () => {
    const { snapshot } = await run([tokenReply, ok(totalsWith(["1", "1", "1", "119.6"])), ok(sourcesReport)]);
    expect(snapshot.metrics.find((m) => m.label === "Avg. session")?.value).toBe("2m 0s");
  });

  it("formats large numbers with thousands separators", async () => {
    const { snapshot } = await run([tokenReply, ok(totalsWith(["1234567", "0", "98765432", "30"])), ok(sourcesReport)]);
    expect(snapshot.metrics.map((m) => m.value)).toEqual(["1,234,567", "0", "98,765,432", "0m 30s"]);
  });

  it.each([
    ["has no rows field", { kind: "analyticsData#runReport", rowCount: 0 }],
    ["has an empty rows list", { ...totalsReport, rows: [] }],
    ["is an empty object", {}],
  ])("shows 'Data not available.' for every metric when the totals report %s", async (_name, totals) => {
    const { snapshot } = await run([tokenReply, ok(totals), ok({ kind: "analyticsData#runReport" })]);
    expect(snapshot.status).toBe("connected");
    expect(snapshot.metrics).toEqual([
      { label: "Active users", value: NOT_AVAILABLE, note: "Thailand, last 28 days" },
      { label: "New users", value: NOT_AVAILABLE },
      { label: "Sessions", value: NOT_AVAILABLE },
      { label: "Avg. session", value: NOT_AVAILABLE },
    ]);
    expect(snapshot.items).toEqual([]);
  });

  it("shows 'Data not available.' for metric values that are not numbers or are missing", async () => {
    const { snapshot } = await run([tokenReply, ok(totalsWith(["(not set)", "12"])), ok(sourcesReport)]);
    expect(snapshot.metrics.map((m) => m.value)).toEqual([NOT_AVAILABLE, "12", NOT_AVAILABLE, NOT_AVAILABLE]);
  });

  it("shows 'Data not available.' for a non-numeric average session", async () => {
    const { snapshot } = await run([tokenReply, ok(totalsWith(["1", "1", "1", "NaN"])), ok(sourcesReport)]);
    expect(snapshot.metrics[3]).toEqual({ label: "Avg. session", value: NOT_AVAILABLE });
  });

  it("names a traffic source without a name '(unknown)'", async () => {
    const sources = { ...sourcesReport, rows: [{ metricValues: [{ value: "10" }] }, { dimensionValues: [{}], metricValues: [{ value: "3" }] }] };
    const { snapshot } = await run([tokenReply, ok(totalsReport), ok(sources)]);
    expect(snapshot.items).toEqual([
      { id: "src-0", title: "(unknown)", detail: "10 sessions" },
      { id: "src-1", title: "(unknown)", detail: "3 sessions" },
    ]);
  });

  it("still lists the traffic sources when the totals report is empty", async () => {
    const { snapshot } = await run([tokenReply, ok({}), ok(sourcesReport)]);
    expect(snapshot.metrics.every((m) => m.value === NOT_AVAILABLE)).toBe(true);
    expect(snapshot.items).toHaveLength(5);
  });

  it("does not glue ' sessions' onto 'Data not available.' when a source has no session count", async () => {
    const sources = { ...sourcesReport, rows: [{ dimensionValues: [{ value: "google" }] }] };
    const { snapshot } = await run([tokenReply, ok(totalsReport), ok(sources)]);
    expect(snapshot.items[0].detail).toBe(NOT_AVAILABLE);
  });
});

describe("ga4Snapshot: errors", () => {
  it("reports the token address's 400 answer as an error and stops", async () => {
    const { snapshot, calls } = await run([fail(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("The service answered 400: Invalid JWT Signature.");
    expect(snapshot.fetchedAt).toBe(NOW.toISOString());
    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.items).toEqual([]);
    expect(calls).toHaveLength(1);
    expectNoSecrets(snapshot, [sentAssertion(calls)]);
  });

  it("explains a 401 from the token address as a refused sign-in", async () => {
    const { snapshot, calls } = await run([fail(401, { error: "unauthorized_client", error_description: "Client is unauthorized to retrieve access tokens." })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("The access token was refused or has expired");
    expect(calls).toHaveLength(1);
    expectNoSecrets(snapshot, [sentAssertion(calls)]);
  });

  it("does not repeat the JWT when the token address echoes it back in its error", async () => {
    const assertion = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW);
    const signature = assertion.split(".")[2];
    const { snapshot, calls } = await run([fail(400, { error: "invalid_grant", error_description: `Bad assertion ${assertion}` })]);
    expect(sentAssertion(calls)).toBe(assertion);
    expect(snapshot.status).toBe("error");
    expectNoSecrets(snapshot, [assertion, signature]);
  });

  it("does not repeat the JWT when a network failure message contains the request body", async () => {
    const assertion = serviceAccountJwt(CLIENT_EMAIL, PRIVATE_KEY, NOW);
    const { snapshot } = await run([{ error: new Error(`socket hang up while sending assertion=${assertion}`) }]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("Could not reach the service");
    expect(snapshot.message).toContain("[redacted]");
    expectNoSecrets(snapshot, [assertion]);
  });

  it("reports an error when Google answers without an access token, and runs no report", async () => {
    const { snapshot, calls } = await run([ok({ token_type: "Bearer", expires_in: 3599 })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("Google did not return an access token.");
    expect(calls).toHaveLength(1);
  });

  it("reports an error when the token answer is not JSON", async () => {
    const { snapshot, calls } = await run([ok("<html>Service Unavailable</html>")]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("The service sent an answer that could not be read.");
    expect(calls).toHaveLength(1);
  });

  it("explains a 403 from the report as missing permission, without metrics", async () => {
    const { snapshot, calls } = await run([tokenReply, fail(403, { error: { code: 403, message: "User does not have sufficient permissions for this property.", status: "PERMISSION_DENIED" } })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("The token does not have permission to read this data. (The service answered 403: User does not have sufficient permissions for this property.)");
    expect(snapshot.metrics).toEqual([]);
    expect(calls).toHaveLength(2);
    expectNoSecrets(snapshot, [sentAssertion(calls)]);
  });

  it("does not repeat the access token when the report error echoes it", async () => {
    const { snapshot } = await run([tokenReply, fail(401, { error: { code: 401, message: `Invalid Credentials: Bearer ${ACCESS_TOKEN}`, status: "UNAUTHENTICATED" } })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("[redacted]");
    expectNoSecrets(snapshot);
  });

  it("does not repeat the access token when the report request fails on the network", async () => {
    const { snapshot } = await run([tokenReply, { error: new Error(`connection reset (Authorization: Bearer ${ACCESS_TOKEN})`) }]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("Could not reach the service");
    expectNoSecrets(snapshot);
  });

  it("reports an error with no partial metrics when the second report fails", async () => {
    const { snapshot, calls } = await run([tokenReply, ok(totalsReport), fail(500, { error: { code: 500, message: "Internal error encountered.", status: "INTERNAL" } })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("The service answered 500");
    expect(snapshot.metrics).toEqual([]);
    expect(snapshot.items).toEqual([]);
    expect(calls).toHaveLength(3);
    expectNoSecrets(snapshot);
  });

  it("explains a 429 from the report as 'slow down'", async () => {
    const { snapshot } = await run([tokenReply, fail(429, { error: { code: 429, message: "Exhausted property tokens per day.", status: "RESOURCE_EXHAUSTED" } })]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("The service asked us to slow down. Try again in a few minutes.");
  });

  it("explains a request that timed out", async () => {
    const { snapshot } = await run([tokenReply, { error: new DOMException("This operation was aborted", "AbortError") }]);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toBe("The service did not answer in time.");
  });

  it.each([["abc"], ["G-ABC123XYZ"], ["properties/123456789"], ["123456789/../987654321"], ["123456789:batchRunReports"], ["123456789?alt=media"]])(
    "blocks a non-numeric property id %j before any request to the Analytics Data API",
    async (propertyId) => {
      const { snapshot, calls } = await run([tokenReply], { env: ga4Env({ GA4_PROPERTY_ID: propertyId }) });
      expect(snapshot.status).toBe("error");
      expect(snapshot.message).toBe("This request is not on the read-only list and was blocked.");
      expect(calls.some((c) => c.url.startsWith("https://analyticsdata.googleapis.com"))).toBe(false);
      expect(calls.map((c) => c.url)).toEqual([TOKEN_URL]);
      expectNoSecrets(snapshot);
    },
  );

  it("does not leak part of a long access token that a report error echoes", async () => {
    const longToken = `fake-access-token-${"x".repeat(240)}`;
    const { snapshot } = await run([ok({ access_token: longToken, token_type: "Bearer" }), fail(401, { error: { code: 401, message: `Invalid Credentials: Bearer ${longToken}` } })]);
    expect(snapshot.status).toBe("error");
    expect(JSON.stringify(snapshot)).not.toContain(longToken.slice(0, 40));
  });
});
