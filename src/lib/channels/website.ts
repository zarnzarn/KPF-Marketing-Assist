// The brand's own public website: title, description and the page list from sitemap.xml.
// Public GET requests only; respects robots.txt.
import { DATA_NOT_AVAILABLE } from "../constants";
import { channelConfig, decodeEntities as decode, thaiDate } from "./config";
import { ChannelError, explain, readOnlyText } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";

export function pageInfo(html: string): { title?: string; description?: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  // Match the closing quote to the opening one, so an apostrophe inside "…" is kept.
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=(["'])([\s\S]*?)\1/i)?.[2] ??
    html.match(/<meta[^>]+content=(["'])([\s\S]*?)\1[^>]+name=["']description["']/i)?.[2];
  return { title: title ? decode(title) : undefined, description: description ? decode(description) : undefined };
}

export function sitemapEntries(xml: string): { loc: string; lastmod?: string }[] {
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)).map((m) => ({
    loc: decode(m[1].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1] ?? ""),
    lastmod: m[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim(),
  })).filter((e) => e.loc);
}

export function sitemapIndex(xml: string): string[] {
  return Array.from(xml.matchAll(/<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi)).map((m) => decode(m[1]));
}

/** True if robots.txt forbids all crawlers from the whole site. */
export function blockedByRobots(robots: string): boolean {
  // A group is one or more User-agent lines followed by rules (RFC 9309).
  let applies = false;
  let readingAgents = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key.trim())) {
      if (!readingAgents) applies = false; // a new group starts
      readingAgents = true;
      if (value === "*") applies = true;
    } else {
      readingAgents = false;
      if (applies && /^disallow$/i.test(key.trim()) && value === "/") return true;
    }
  }
  return false;
}

/** True when `url` is on the same host as `root` (not just a look-alike prefix). "www." is ignored on both sides. */
export function sameHost(url: string, root: string): boolean {
  const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");
  try {
    const a = new URL(url);
    const b = new URL(root);
    return a.protocol === "https:" && bare(a.host) === bare(b.host);
  } catch {
    return false;
  }
}

/** The website needs no token, so "refused" means the site (or the network) blocked the reader, not a permission problem. */
function websiteProblem(error: unknown): string {
  if (error instanceof ChannelError && (error.kind === "auth" || error.kind === "permission" || error.kind === "not_found")) {
    const status = error.message.match(/answered (\d{3})/)?.[1];
    const http = status ? ` (HTTP ${status})` : "";
    return error.kind === "not_found"
      ? `The website home page was not found${http}. Check WEBSITE_URL in .env.local.`
      : `The website refused the request${http}. It may block automated readers or this network. Open the site in a browser to check it is up.`;
  }
  return explain(error);
}

const MAX_CHILD_SITEMAPS = 5;

/** "/products/eggs?x=1" from a full address (works for www and non-www pages alike). */
function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

export async function websiteSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { url } = channelConfig(deps.env).website;
  const base = { channel: "website" as const, label: "Website", metrics: [], items: [] };
  const now = deps.now ?? new Date();
  const req = { fetchImpl: deps.fetchImpl, headers: { "User-Agent": "KPF-Marketing-Assist (read-only)" } };
  try {
    const root = url.replace(/\/+$/, "");
    let robots = "";
    try {
      robots = await readOnlyText(`${root}/robots.txt`, req);
    } catch {
      // no robots.txt: allowed
    }
    if (blockedByRobots(robots)) return { ...base, status: "error", fetchedAt: now.toISOString(), message: "The website's robots.txt asks automated readers not to read it, so it was not read." };

    const home = pageInfo(await readOnlyText(root, req));
    let pages: { loc: string; lastmod?: string }[] = [];
    let childTotal = 0;
    let childNotRead = 0;
    try {
      const xml = await readOnlyText(`${root}/sitemap.xml`, req);
      pages = sitemapEntries(xml);
      const children = sitemapIndex(xml);
      const toRead = children.filter((u) => sameHost(u, root)).slice(0, MAX_CHILD_SITEMAPS);
      childTotal = children.length;
      childNotRead = children.length - toRead.length; // other hosts, or over the limit
      for (const child of toRead) {
        try {
          pages.push(...sitemapEntries(await readOnlyText(child, req)));
        } catch {
          childNotRead++; // one broken sitemap file must not hide the others
        }
      }
    } catch {
      // sitemap missing: report what we have
    }
    // A partial count is labelled as such, so it is never repeated as the full number.
    const pageCount = pages.length ? (childNotRead ? `at least ${pages.length}` : String(pages.length)) : DATA_NOT_AVAILABLE;
    pages.sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""));
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Site title", value: home.title ?? DATA_NOT_AVAILABLE },
        { label: "Pages in sitemap", value: pageCount, ...(childNotRead ? { note: `${childNotRead} of ${childTotal} sitemap files not read` } : {}) },
      ],
      items: [
        ...(home.description ? [{ id: "description", title: "Home page description", detail: home.description }] : []),
        ...pages.slice(0, 8).map((p) => ({ id: p.loc, title: pathOf(p.loc), url: /^https:\/\//.test(p.loc) ? p.loc : undefined, date: thaiDate(p.lastmod) })),
      ],
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: websiteProblem(error) };
  }
}
