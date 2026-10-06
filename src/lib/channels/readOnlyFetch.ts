// The ONLY way channel code may call the internet. Server-side only.
//
// Read-only by design:
//  - GET requests are allowed.
//  - POST is allowed ONLY for a short list of endpoints that READ data but
//    require POST by their API design (Google sign-in token, GA4 runReport,
//    Shopify GraphQL queries). Shopify bodies containing "mutation" are refused.
//  - Any other method or POST target throws before a request is made.
// Secrets (tokens, keys) are redacted from every error message.

export type ChannelErrorKind = "auth" | "permission" | "not_found" | "rate_limit" | "timeout" | "network" | "bad_response" | "blocked";

export class ChannelError extends Error {
  constructor(
    message: string,
    public readonly kind: ChannelErrorKind,
  ) {
    super(message);
    this.name = "ChannelError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ReadOnlyRequest {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Only for allow-listed read-only POST endpoints. */
  body?: string;
  /** Values that must never appear in errors or logs (tokens, keys). */
  secrets?: string[];
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

const READ_ONLY_POST: RegExp[] = [
  /^https:\/\/oauth2\.googleapis\.com\/token$/,
  /^https:\/\/analyticsdata\.googleapis\.com\/v1beta\/properties\/\d+:runReport$/,
  /^https:\/\/[a-z0-9-]+\.myshopify\.com\/admin\/api\/[0-9-]+\/graphql\.json$/,
];

export function isAllowedPost(url: string, body = ""): boolean {
  if (!READ_ONLY_POST.some((r) => r.test(url))) return false;
  if (/myshopify\.com/.test(url) && /\bmutation\b/i.test(body)) return false;
  return true;
}

export function redact(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets.filter((x) => x && x.length >= 4)) out = out.split(s).join("[redacted]");
  return out;
}

function kindForStatus(status: number): ChannelErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  return "bad_response";
}

/** Makes one read-only request and returns the raw text body. Throws ChannelError on any problem. */
export async function readOnlyText(url: string, req: ReadOnlyRequest = {}): Promise<string> {
  const method = req.method ?? "GET";
  const secrets = req.secrets ?? [];
  if (!/^https:\/\//.test(url)) throw new ChannelError("Only secure (https) addresses are allowed.", "blocked");
  if (method !== "GET" && method !== "POST") throw new ChannelError(`${method} requests are not allowed (read-only).`, "blocked");
  if (method === "POST" && !isAllowedPost(url, req.body)) throw new ChannelError("This request is not on the read-only list and was blocked.", "blocked");
  if (method === "GET" && req.body) throw new ChannelError("GET requests cannot send a body.", "blocked");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 8000);
  const doFetch: FetchLike = req.fetchImpl ?? ((input, init) => fetch(input, init));
  let response: Response;
  try {
    response = await doFetch(url, { method, headers: req.headers, body: req.body, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ChannelError(aborted ? "The service did not answer in time." : redact(`Could not reach the service: ${error instanceof Error ? error.message : String(error)}`, secrets), aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) {
    let detail = "";
    try {
      const body = JSON.parse(text);
      detail = body?.error?.message ?? body?.message ?? body?.error_description ?? "";
    } catch {
      // not JSON
    }
    throw new ChannelError(redact(`The service answered ${response.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}.`, secrets), kindForStatus(response.status));
  }
  return text;
}

/** Read-only request that expects JSON. */
export async function readOnlyJson<T = unknown>(url: string, req: ReadOnlyRequest = {}): Promise<T> {
  const text = await readOnlyText(url, req);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ChannelError("The service sent an answer that could not be read.", "bad_response");
  }
}

/** Plain-language explanation for the Channels page. */
export function explain(error: unknown): string {
  if (!(error instanceof ChannelError)) return "Something went wrong while reading this channel.";
  switch (error.kind) {
    case "auth":
      return `The access token was refused or has expired. Create a new one and update .env.local. (${error.message})`;
    case "permission":
      return `The token does not have permission to read this data. (${error.message})`;
    case "rate_limit":
      return "The service asked us to slow down. Try again in a few minutes.";
    case "timeout":
      return error.message;
    case "not_found":
      return `The account or page id was not found. Check the id in .env.local. (${error.message})`;
    default:
      return error.message;
  }
}
