// The brand's own public website: title, description and the page list from sitemap.xml.
// Public GET requests only; respects robots.txt.
import { channelConfig, thaiDate } from "./config";
import { explain, readOnlyText } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

export function pageInfo(html: string): { title?: string; description?: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1];
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
  let applies = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*";
    else if (applies && /^disallow$/i.test(key) && value === "/") return true;
  }
  return false;
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
    try {
      const xml = await readOnlyText(`${root}/sitemap.xml`, req);
      pages = sitemapEntries(xml);
      const children = sitemapIndex(xml).filter((u) => u.startsWith(root)).slice(0, 5);
      for (const child of children) pages.push(...sitemapEntries(await readOnlyText(child, req)));
    } catch {
      // sitemap missing: report what we have
    }
    pages.sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""));
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Site title", value: home.title ?? "Data not available." },
        { label: "Pages in sitemap", value: pages.length ? String(pages.length) : "Data not available." },
      ],
      items: [
        ...(home.description ? [{ id: "description", title: "Home page description", detail: home.description }] : []),
        ...pages.slice(0, 8).map((p) => ({ id: p.loc, title: p.loc.replace(root, "") || "/", url: p.loc, date: thaiDate(p.lastmod) })),
      ],
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: explain(error) };
  }
}
