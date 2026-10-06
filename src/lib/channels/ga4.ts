// Website traffic from Google Analytics 4 (official Data API), Thailand only.
// Uses a read-only service account whose key file lives OUTSIDE the project.
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { channelConfig, num } from "./config";
import { ChannelError, explain, readOnlyJson } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** Builds the signed sign-in request (JWT) for a Google service account. */
export function serviceAccountJwt(clientEmail: string, privateKey: string, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(privateKey))}`;
}

interface ReportRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

export async function ga4Snapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { propertyId, keyFile } = channelConfig(deps.env).ga4;
  const base = { channel: "ga4" as const, label: "Website traffic (GA4)", metrics: [], items: [] };
  if (!propertyId || !keyFile) return { ...base, status: "not_configured", message: "Add GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON_PATH (a key file outside the project folder) to .env.local." };
  const now = deps.now ?? new Date();
  const read = deps.readFile ?? ((p: string) => readFile(p, "utf8"));
  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(await read(keyFile));
  } catch {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: "The GA4 key file could not be read. Check GA4_SERVICE_ACCOUNT_JSON_PATH." };
  }
  if (!key.client_email || !key.private_key) return { ...base, status: "error", fetchedAt: now.toISOString(), message: "The GA4 key file is not a service-account key (client_email or private_key is missing)." };

  const secrets = [key.private_key];
  try {
    const assertion = serviceAccountJwt(key.client_email, key.private_key, now);
    const auth = await readOnlyJson<{ access_token?: string }>(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      secrets: [...secrets, assertion],
      fetchImpl: deps.fetchImpl,
    });
    if (!auth.access_token) throw new ChannelError("Google did not return an access token.", "auth");
    secrets.push(auth.access_token);

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
    const thailand = { filter: { fieldName: "country", stringFilter: { value: "Thailand" } } };
    const run = (body: object) =>
      readOnlyJson<{ rows?: ReportRow[] }>(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        secrets,
        fetchImpl: deps.fetchImpl,
      });

    const totals = await run({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }, { name: "averageSessionDuration" }], dimensionFilter: thailand });
    const sources = await run({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }], dimensionFilter: thailand, orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 5 });

    const m = totals.rows?.[0]?.metricValues?.map((x) => Number(x.value));
    const seconds = m?.[3];
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Active users", value: m ? num(m[0]) : "Data not available.", note: "Thailand, last 28 days" },
        { label: "New users", value: m ? num(m[1]) : "Data not available." },
        { label: "Sessions", value: m ? num(m[2]) : "Data not available." },
        { label: "Avg. session", value: seconds !== undefined && Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : "Data not available." },
      ],
      items: (sources.rows ?? []).map((r, i) => ({ id: `src-${i}`, title: r.dimensionValues?.[0]?.value ?? "(unknown)", detail: `${num(Number(r.metricValues?.[0]?.value))} sessions` })),
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: explain(error) };
  }
}
