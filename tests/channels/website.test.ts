import { describe, expect, it } from "vitest";
import { blockedByRobots, pageInfo, sitemapEntries, sitemapIndex, websiteSnapshot } from "@/lib/channels/website";
import type { FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic: a made-up shop on example.com with made-up pages.
// The network is never used: every snapshot test injects fetchImpl.

const SITE = "https://shop.example.com";
const DEFAULT_SITE = "https://www.klongphaifarm.com";
// 2026-10-06 10:00 in Thailand.
const NOW = new Date("2026-10-06T03:00:00.000Z");

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status: number; body: string; type: string } | "network-error";

/** A fake fetch that answers by address and records every call. Unknown addresses fail like a network error. */
function routedFetch(routes: Record<string, Reply>) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body });
    const reply = routes[url];
    if (!reply || reply === "network-error") throw new TypeError(`fetch failed for ${url}`);
    return new Response(reply.body, { status: reply.status, headers: { "Content-Type": reply.type } });
  };
  return { fetchImpl, calls };
}

const text = (body: string, status = 200): Reply => ({ status, body, type: "text/plain" });
const html = (body: string, status = 200): Reply => ({ status, body, type: "text/html; charset=utf-8" });
const xml = (body: string, status = 200): Reply => ({ status, body, type: "application/xml" });
const notFound = (): Reply => ({ status: 404, body: "<html><body>Not found</body></html>", type: "text/html" });

const homePage = (title = "Synthetic Farm &amp; Eggs", description = "A synthetic home page used only in tests.") =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${description}"></head><body><h1>Synthetic</h1></body></html>`;

/** Shaped like a sitemaps.org <urlset>. */
const urlset = (entries: { loc: string; lastmod?: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url>\n    <loc>${e.loc}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ""}  </url>`)
    .join("\n")}\n</urlset>`;

/** Shaped like a sitemaps.org <sitemapindex>. */
const sitemapIndexXml = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs
    .map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>2026-09-01</lastmod>\n  </sitemap>`)
    .join("\n")}\n</sitemapindex>`;

const allowAll = "User-agent: *\nDisallow:\n";

/** The usual three answers for a healthy site. */
function healthySite(root = SITE, overrides: Record<string, Reply> = {}) {
  return {
    [`${root}/robots.txt`]: text(allowAll),
    [root]: html(homePage()),
    [`${root}/sitemap.xml`]: xml(urlset([{ loc: `${root}/`, lastmod: "2026-09-01" }, { loc: `${root}/products/eggs`, lastmod: "2026-09-15" }])),
    ...overrides,
  };
}

/** Asserts that only read-only GET requests were made, with no body. */
function expectOnlyGet(calls: RecordedCall[]) {
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    expect(call.method).toBe("GET");
    expect(call.method).not.toBe("POST");
    expect(call.body).toBeUndefined();
  }
}

const metric = (snap: ChannelSnapshot, label: string) => snap.metrics.find((m) => m.label === label)?.value;

describe("pageInfo", () => {
  it("reads the title and decodes &amp; &quot; and &#39;", () => {
    const info = pageInfo("<html><head><title>Synthetic Farm &amp; Eggs &quot;Fresh&quot; &#39;Daily&#39;</title></head></html>");
    expect(info.title).toBe(`Synthetic Farm & Eggs "Fresh" 'Daily'`);
  });

  it("decodes numeric entities such as &#8211; and &#039;, and &amp; last so &amp;lt; stays &lt;", () => {
    const info = pageInfo("<title>Farm &#8211; Eggs &#039;Fresh&#039; &#x2014; &amp;lt;tag&amp;gt; &#99999999;</title>");
    expect(info.title).toBe("Farm – Eggs 'Fresh' — &lt;tag&gt;");
  });

  it("decodes &lt; and &gt; and trims spaces and line breaks around the title", () => {
    const info = pageInfo("<title data-x=\"1\">\n   Eggs &lt;Grade A&gt;  \n</title>");
    expect(info.title).toBe("Eggs <Grade A>");
  });

  it("reads the meta description when name comes before content", () => {
    const info = pageInfo('<head><meta name="description" content="Synthetic description &amp; more"></head>');
    expect(info.description).toBe("Synthetic description & more");
  });

  it("reads the meta description when content comes before name", () => {
    const info = pageInfo('<head><meta content="Content-first description" name="description" /></head>');
    expect(info.description).toBe("Content-first description");
  });

  it("accepts single quotes and any letter case in the description tag", () => {
    expect(pageInfo("<META NAME='Description' CONTENT='Single quoted'>").description).toBe("Single quoted");
  });

  it("ignores other meta tags such as og:description", () => {
    const info = pageInfo('<meta property="og:description" content="Open Graph only"><meta name="keywords" content="eggs">');
    expect(info.description).toBeUndefined();
  });

  it("returns neither title nor description when the page has none", () => {
    const info = pageInfo("<html><head><meta charset='utf-8'></head><body>Hello</body></html>");
    expect(info.title).toBeUndefined();
    expect(info.description).toBeUndefined();
  });

  it("treats an empty title and an empty description as missing", () => {
    const info = pageInfo('<title></title><meta name="description" content="">');
    expect(info.title).toBeUndefined();
    expect(info.description).toBeUndefined();
  });

  it("returns nothing for an empty string", () => {
    expect(pageInfo("")).toEqual({ title: undefined, description: undefined });
  });

  it("keeps an apostrophe inside a double-quoted description", () => {
    expect(pageInfo(`<meta name="description" content="The farm's synthetic eggs">`).description).toBe("The farm's synthetic eggs");
  });
});

describe("sitemapEntries", () => {
  it("reads loc and lastmod for each url", () => {
    const entries = sitemapEntries(
      urlset([
        { loc: `${SITE}/`, lastmod: "2026-09-01" },
        { loc: `${SITE}/products/eggs`, lastmod: "2026-09-15T08:00:00+07:00" },
      ]),
    );
    expect(entries).toEqual([
      { loc: `${SITE}/`, lastmod: "2026-09-01" },
      { loc: `${SITE}/products/eggs`, lastmod: "2026-09-15T08:00:00+07:00" },
    ]);
  });

  it("decodes entities in loc and trims spaces in loc and lastmod", () => {
    const entries = sitemapEntries(`<urlset><url><loc>  ${SITE}/search?type=eggs&amp;size=large  </loc><lastmod> 2026-09-20 </lastmod></url></urlset>`);
    expect(entries).toEqual([{ loc: `${SITE}/search?type=eggs&size=large`, lastmod: "2026-09-20" }]);
  });

  it("leaves lastmod out when a url has none", () => {
    const entries = sitemapEntries(`<urlset><url><loc>${SITE}/about</loc></url></urlset>`);
    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe(`${SITE}/about`);
    expect(entries[0].lastmod).toBeUndefined();
  });

  it("drops entries without a loc or with an empty loc", () => {
    const entries = sitemapEntries(
      `<urlset><url><lastmod>2026-09-01</lastmod></url><url><loc>   </loc></url><url><loc>${SITE}/kept</loc></url></urlset>`,
    );
    expect(entries).toEqual([{ loc: `${SITE}/kept`, lastmod: undefined }]);
  });

  it("returns an empty list for a sitemap index, an empty urlset or text that is not XML", () => {
    expect(sitemapEntries(sitemapIndexXml([`${SITE}/sitemap-1.xml`]))).toEqual([]);
    expect(sitemapEntries(urlset([]))).toEqual([]);
    expect(sitemapEntries("not xml at all")).toEqual([]);
    expect(sitemapEntries("")).toEqual([]);
  });
});

describe("sitemapIndex", () => {
  it("returns the loc of every child sitemap, in order", () => {
    expect(sitemapIndex(sitemapIndexXml([`${SITE}/sitemap-products.xml`, `${SITE}/sitemap-blog.xml`]))).toEqual([
      `${SITE}/sitemap-products.xml`,
      `${SITE}/sitemap-blog.xml`,
    ]);
  });

  it("decodes entities and trims spaces in child locs", () => {
    expect(sitemapIndex(`<sitemapindex><sitemap><loc> ${SITE}/sitemap.xml?part=1&amp;lang=th </loc></sitemap></sitemapindex>`)).toEqual([
      `${SITE}/sitemap.xml?part=1&lang=th`,
    ]);
  });

  it("returns an empty list for an ordinary urlset or empty text", () => {
    expect(sitemapIndex(urlset([{ loc: `${SITE}/`, lastmod: "2026-09-01" }]))).toEqual([]);
    expect(sitemapIndex("")).toEqual([]);
  });
});

describe("blockedByRobots", () => {
  it("is true when every crawler is disallowed from the whole site", () => {
    expect(blockedByRobots("User-agent: *\nDisallow: /")).toBe(true);
  });

  it("is false when only part of the site is disallowed", () => {
    expect(blockedByRobots("User-agent: *\nDisallow: /admin\nDisallow: /cart")).toBe(false);
  });

  it("is false when an empty Disallow allows everything", () => {
    expect(blockedByRobots(allowAll)).toBe(false);
  });

  it("is false when Disallow: / is only for another user agent", () => {
    expect(blockedByRobots("User-agent: SyntheticBadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin")).toBe(false);
    expect(blockedByRobots("User-agent: *\nDisallow: /admin\n\nUser-agent: SyntheticBadBot\nDisallow: /")).toBe(false);
  });

  it("ignores Disallow lines that come before any User-agent line", () => {
    expect(blockedByRobots("Disallow: /\nUser-agent: *\nAllow: /")).toBe(false);
  });

  it("ignores comments, including a commented-out block", () => {
    expect(blockedByRobots("# User-agent: *\n# Disallow: /\nUser-agent: *\nDisallow: /private")).toBe(false);
    expect(blockedByRobots("User-agent: * # everyone\nDisallow: / # the whole site")).toBe(true);
  });

  it("reads Windows (CRLF) line endings", () => {
    expect(blockedByRobots("User-agent: *\r\nDisallow: /\r\n")).toBe(true);
    expect(blockedByRobots("User-agent: *\r\nDisallow: /admin\r\n")).toBe(false);
  });

  it("accepts any letter case and no space after the colon", () => {
    expect(blockedByRobots("user-agent:*\ndisallow:/")).toBe(true);
    expect(blockedByRobots("USER-AGENT: *\nDISALLOW: /")).toBe(true);
  });

  it("is false for an empty file", () => {
    expect(blockedByRobots("")).toBe(false);
    expect(blockedByRobots("\n\n")).toBe(false);
  });

  it("still sees Disallow: / when the * group also has a Sitemap line", () => {
    expect(blockedByRobots(`User-agent: *\nDisallow: /\nSitemap: ${SITE}/sitemap.xml`)).toBe(true);
  });

  it("is true when * shares a group with another user agent listed after it", () => {
    expect(blockedByRobots("User-agent: *\nUser-agent: SyntheticBot\nDisallow: /")).toBe(true);
  });
});

describe("websiteSnapshot — addresses and requests", () => {
  it("reads https://www.klongphaifarm.com when WEBSITE_URL is not set", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(DEFAULT_SITE));
    const snap = await websiteSnapshot({ env: {}, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([`${DEFAULT_SITE}/robots.txt`, DEFAULT_SITE, `${DEFAULT_SITE}/sitemap.xml`]);
    expect(snap.status).toBe("connected");
  });

  it("uses the default address when WEBSITE_URL is blank or only quotes", async () => {
    for (const value of ["", "   ", '""']) {
      const { fetchImpl, calls } = routedFetch(healthySite(DEFAULT_SITE));
      await websiteSnapshot({ env: { WEBSITE_URL: value }, fetchImpl, now: NOW });
      expect(calls[0].url).toBe(`${DEFAULT_SITE}/robots.txt`);
    }
  });

  it("uses WEBSITE_URL and removes trailing slashes", async () => {
    for (const value of [SITE, `${SITE}/`, `${SITE}///`, ` "${SITE}/" `]) {
      const { fetchImpl, calls } = routedFetch(healthySite());
      const snap = await websiteSnapshot({ env: { WEBSITE_URL: value }, fetchImpl, now: NOW });
      expect(calls.map((c) => c.url)).toEqual([`${SITE}/robots.txt`, SITE, `${SITE}/sitemap.xml`]);
      expect(snap.status).toBe("connected");
    }
  });

  it("requests robots.txt, the home page and sitemap.xml with GET and a read-only User-Agent", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite());
    await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(3);
    expectOnlyGet(calls);
    for (const call of calls) {
      expect(call.headers["User-Agent"]).toContain("read-only");
      expect(call.headers.Authorization).toBeUndefined();
    }
  });

  it("never sends other channels' secrets from .env.local to the website", async () => {
    const secrets = ["test-token-1234567890", "fake-secret-abcdef", "fake-shop-key-0987654321"];
    const env = {
      WEBSITE_URL: SITE,
      META_PAGE_ACCESS_TOKEN: secrets[0],
      LINE_CHANNEL_ACCESS_TOKEN: secrets[1],
      SHOP_API_KEY: secrets[2],
      SHOP_API_SECRET: secrets[1],
    };
    const { fetchImpl, calls } = routedFetch(healthySite());
    const snap = await websiteSnapshot({ env, fetchImpl, now: NOW });
    for (const secret of secrets) {
      expect(JSON.stringify(calls)).not.toContain(secret);
      expect(JSON.stringify(snap)).not.toContain(secret);
    }
  });

  it("refuses a plain http address without making any request", async () => {
    const { fetchImpl, calls } = routedFetch({});
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: "http://shop.example.com" }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("Only secure (https) addresses are allowed.");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
  });
});

describe("websiteSnapshot — robots.txt", () => {
  it("stops with an error and does not read the home page when robots.txt blocks everyone", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: text("User-agent: *\nDisallow: /\n") }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([`${SITE}/robots.txt`]);
    expect(calls.map((c) => c.url)).not.toContain(SITE);
    expect(snap.channel).toBe("website");
    expect(snap.label).toBe("Website");
    expect(snap.status).toBe("error");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toContain("robots.txt");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
  });

  it("also stops for a blocking robots.txt with CRLF line endings and comments", async () => {
    const robots = "# synthetic robots file\r\nUser-agent: * # everyone\r\nDisallow: / # whole site\r\n";
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: text(robots) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(1);
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("robots.txt");
  });

  it("reads the site when robots.txt only blocks some folders", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: text("User-agent: *\nDisallow: /admin\nDisallow: /cart\n") }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(3);
    expect(snap.status).toBe("connected");
  });

  it("reads the site when robots.txt blocks only another user agent", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: text("User-agent: SyntheticBadBot\nDisallow: /\n") }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
  });

  it("treats a missing robots.txt (404) as allowed", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: notFound() }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([`${SITE}/robots.txt`, SITE, `${SITE}/sitemap.xml`]);
    expect(snap.status).toBe("connected");
    expect(snap.message).toBeUndefined();
  });

  it("treats an unreachable robots.txt as allowed", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/robots.txt`]: "network-error" }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
  });
});

describe("websiteSnapshot — connected", () => {
  it("shows the site title, the number of sitemap pages and the home page description", async () => {
    const { fetchImpl } = routedFetch(healthySite());
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.channel).toBe("website");
    expect(snap.label).toBe("Website");
    expect(snap.status).toBe("connected");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toBeUndefined();
    expect(snap.metrics).toEqual([
      { label: "Site title", value: "Synthetic Farm & Eggs" },
      { label: "Pages in sitemap", value: "2" },
    ]);
    expect(snap.items[0]).toEqual({ id: "description", title: "Home page description", detail: "A synthetic home page used only in tests." });
    expect(snap.items).toHaveLength(3);
  });

  it("uses the current time for fetchedAt when now is not given", async () => {
    const { fetchImpl } = routedFetch(healthySite());
    const before = Date.now();
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl });
    const fetched = Date.parse(snap.fetchedAt ?? "");
    expect(fetched).toBeGreaterThanOrEqual(before);
    expect(fetched).toBeLessThanOrEqual(Date.now());
  });

  it("sorts pages newest first, keeps the description plus 8 pages, uses the path as title and Thai dates", async () => {
    const pages = [
      { loc: `${SITE}/faq`, lastmod: "2026-01-10" },
      { loc: `${SITE}/products/eggs`, lastmod: "2026-09-29" },
      { loc: `${SITE}/no-date` },
      { loc: `${SITE}/`, lastmod: "2026-09-25" },
      { loc: `${SITE}/blog/recipe-2`, lastmod: "2026-09-26" },
      // 20:00 UTC on 30 September is 03:00 on 1 October in Thailand.
      { loc: `${SITE}/products/free-range-chicken`, lastmod: "2026-09-30T20:00:00Z" },
      { loc: `${SITE}/contact`, lastmod: "2026-08-01" },
      { loc: `${SITE}/blog/old-post`, lastmod: "2025-12-31" },
      { loc: `${SITE}/products/duck`, lastmod: "2026-09-28" },
      { loc: `${SITE}/about`, lastmod: "2026-08-15" },
      { loc: `${SITE}/blog/recipe-1`, lastmod: "2026-09-27" },
    ];
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset(pages)) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });

    expect(metric(snap, "Pages in sitemap")).toBe("11");
    expect(snap.items).toHaveLength(9);
    expect(snap.items[0].id).toBe("description");
    expect(snap.items.slice(1)).toEqual([
      { id: `${SITE}/products/free-range-chicken`, title: "/products/free-range-chicken", url: `${SITE}/products/free-range-chicken`, date: "2026-10-01" },
      { id: `${SITE}/products/eggs`, title: "/products/eggs", url: `${SITE}/products/eggs`, date: "2026-09-29" },
      { id: `${SITE}/products/duck`, title: "/products/duck", url: `${SITE}/products/duck`, date: "2026-09-28" },
      { id: `${SITE}/blog/recipe-1`, title: "/blog/recipe-1", url: `${SITE}/blog/recipe-1`, date: "2026-09-27" },
      { id: `${SITE}/blog/recipe-2`, title: "/blog/recipe-2", url: `${SITE}/blog/recipe-2`, date: "2026-09-26" },
      { id: `${SITE}/`, title: "/", url: `${SITE}/`, date: "2026-09-25" },
      { id: `${SITE}/about`, title: "/about", url: `${SITE}/about`, date: "2026-08-15" },
      { id: `${SITE}/contact`, title: "/contact", url: `${SITE}/contact`, date: "2026-08-01" },
    ]);
    const titles = snap.items.map((i) => i.title);
    expect(titles).not.toContain("/faq");
    expect(titles).not.toContain("/blog/old-post");
    expect(titles).not.toContain("/no-date");
  });

  it('uses "/" as the title for the home page with or without a trailing slash', async () => {
    const pages = [{ loc: SITE, lastmod: "2026-09-02" }, { loc: `${SITE}/`, lastmod: "2026-09-01" }];
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset(pages)) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.items.slice(1).map((i) => i.title)).toEqual(["/", "/"]);
  });

  it("puts pages without a lastmod last and leaves their date empty", async () => {
    const pages = [{ loc: `${SITE}/undated` }, { loc: `${SITE}/dated`, lastmod: "2026-09-01" }];
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset(pages)) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    const pageItems = snap.items.slice(1);
    expect(pageItems.map((i) => i.title)).toEqual(["/dated", "/undated"]);
    expect(pageItems[0].date).toBe("2026-09-01");
    expect(pageItems[1].date).toBeUndefined();
  });

  it("leaves the date empty when a lastmod cannot be read", async () => {
    const pages = [{ loc: `${SITE}/odd`, lastmod: "not-a-date" }];
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset(pages)) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.items[1].title).toBe("/odd");
    expect(snap.items[1].date).toBeUndefined();
  });

  it("shows no description item when the home page has no meta description", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [SITE]: html("<html><head><title>Synthetic Farm</title></head></html>") }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.items.map((i) => i.id)).not.toContain("description");
    expect(snap.items).toHaveLength(2);
    expect(metric(snap, "Site title")).toBe("Synthetic Farm");
  });

  it('shows "Data not available." for the site title when the home page has no title', async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [SITE]: html("<html><body>No head here</body></html>") }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Site title")).toBe("Data not available.");
  });
});

describe("websiteSnapshot — sitemap index", () => {
  it("reads child sitemaps on the same site and ignores other hosts", async () => {
    const otherHost = "https://cdn.other-example.test/sitemap-partner.xml";
    const routes = healthySite(SITE, {
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${SITE}/sitemap-products.xml`, otherHost, `${SITE}/sitemap-blog.xml`])),
      [`${SITE}/sitemap-products.xml`]: xml(
        urlset([
          { loc: `${SITE}/products/eggs`, lastmod: "2026-09-10" },
          { loc: `${SITE}/products/duck`, lastmod: "2026-09-20" },
        ]),
      ),
      [`${SITE}/sitemap-blog.xml`]: xml(
        urlset([
          { loc: `${SITE}/blog/recipe-1`, lastmod: "2026-09-15" },
          { loc: `${SITE}/blog/recipe-2`, lastmod: "2026-09-05" },
        ]),
      ),
      [otherHost]: xml(urlset([{ loc: "https://cdn.other-example.test/partner-page", lastmod: "2026-10-01" }])),
    });
    const { fetchImpl, calls } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });

    expect(calls.map((c) => c.url)).toEqual([
      `${SITE}/robots.txt`,
      SITE,
      `${SITE}/sitemap.xml`,
      `${SITE}/sitemap-products.xml`,
      `${SITE}/sitemap-blog.xml`,
    ]);
    expect(calls.map((c) => c.url)).not.toContain(otherHost);
    expectOnlyGet(calls);
    for (const call of calls) expect(call.headers["User-Agent"]).toContain("read-only");

    expect(snap.status).toBe("connected");
    // One child sitemap (on another host) was not read, so the count is a minimum and says why.
    expect(snap.metrics.find((m) => m.label === "Pages in sitemap")).toEqual({ label: "Pages in sitemap", value: "at least 4", note: "1 of 3 sitemap files not read" });
    expect(snap.items.slice(1).map((i) => i.title)).toEqual(["/products/duck", "/blog/recipe-1", "/products/eggs", "/blog/recipe-2"]);
  });

  it("reads at most 5 child sitemaps", async () => {
    const children = Array.from({ length: 7 }, (_, i) => `${SITE}/sitemap-${i + 1}.xml`);
    const routes: Record<string, Reply> = healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml(children)) });
    children.forEach((child, i) => {
      routes[child] = xml(urlset([{ loc: `${SITE}/page-${i + 1}`, lastmod: `2026-09-0${i + 1}` }]));
    });
    const { fetchImpl, calls } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });

    expect(calls.map((c) => c.url).slice(3)).toEqual(children.slice(0, 5));
    expect(calls.map((c) => c.url)).not.toContain(children[5]);
    expect(calls.map((c) => c.url)).not.toContain(children[6]);
    expect(snap.metrics.find((m) => m.label === "Pages in sitemap")).toEqual({ label: "Pages in sitemap", value: "at least 5", note: "2 of 7 sitemap files not read" });
  });

  it("keeps the pages already read when a later child sitemap fails", async () => {
    const routes = healthySite(SITE, {
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${SITE}/sitemap-1.xml`, `${SITE}/sitemap-2.xml`])),
      [`${SITE}/sitemap-1.xml`]: xml(urlset([{ loc: `${SITE}/products/eggs`, lastmod: "2026-09-10" }])),
      [`${SITE}/sitemap-2.xml`]: xml("<html>Server error</html>", 500),
    });
    const { fetchImpl } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.metrics.find((m) => m.label === "Pages in sitemap")).toEqual({ label: "Pages in sitemap", value: "at least 1", note: "1 of 2 sitemap files not read" });
    expect(snap.items.slice(1).map((i) => i.title)).toEqual(["/products/eggs"]);
  });

  it("does not read a child sitemap on a look-alike host that only starts with the site address", async () => {
    const lookAlike = `${SITE}.other-example.test/sitemap.xml`;
    const routes = healthySite(SITE, {
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${SITE}/sitemap-1.xml`, lookAlike])),
      [`${SITE}/sitemap-1.xml`]: xml(urlset([{ loc: `${SITE}/products/eggs`, lastmod: "2026-09-10" }])),
      [lookAlike]: xml(urlset([{ loc: `${SITE}.other-example.test/elsewhere`, lastmod: "2026-09-11" }])),
    });
    const { fetchImpl, calls } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).not.toContain(lookAlike);
    expect(metric(snap, "Pages in sitemap")).toBe("at least 1");
  });

  it("shows a sitemap entry on another site with its full address, so the link never looks like it stays on the site", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset([{ loc: "https://other-host.example.net/products/eggs", lastmod: "2026-09-10" }, { loc: `${SITE}/products/duck`, lastmod: "2026-09-01" }])) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.items.slice(1).map((i) => i.title)).toEqual(["https://other-host.example.net/products/eggs", "/products/duck"]);
  });

  it("gives the plain count, with no note, when every child sitemap was read", async () => {
    const routes = healthySite(SITE, {
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${SITE}/sitemap-1.xml`])),
      [`${SITE}/sitemap-1.xml`]: xml(urlset([{ loc: `${SITE}/products/eggs`, lastmod: "2026-09-10" }])),
    });
    const { fetchImpl } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.metrics.find((m) => m.label === "Pages in sitemap")).toEqual({ label: "Pages in sitemap", value: "1" });
  });

  it("reads child sitemaps on the same site with or without www, and CDATA addresses", async () => {
    const www = "https://www.shop.example.com";
    const routes = healthySite(SITE, {
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${www}/sitemap-1.xml`])),
      [`${www}/sitemap-1.xml`]: xml(urlset([{ loc: `<![CDATA[${www}/products/eggs?size=10&amp;pack=2]]>`, lastmod: "2026-09-10" }])),
    });
    const { fetchImpl, calls } = routedFetch(routes);
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toContain(`${www}/sitemap-1.xml`);
    expect(metric(snap, "Pages in sitemap")).toBe("1");
    const page = snap.items.find((i) => i.id !== "description" && i.title.startsWith("/products"));
    expect(page).toMatchObject({ title: "/products/eggs?size=10&pack=2", url: `${www}/products/eggs?size=10&pack=2` });
  });
});

describe("websiteSnapshot — missing sitemap and errors", () => {
  it('stays connected and shows "Data not available." for pages when sitemap.xml is 404', async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: notFound() }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(3);
    expect(snap.status).toBe("connected");
    expect(snap.message).toBeUndefined();
    expect(snap.metrics).toEqual([
      { label: "Site title", value: "Synthetic Farm & Eggs" },
      { label: "Pages in sitemap", value: "Data not available." },
    ]);
    expect(snap.items).toEqual([{ id: "description", title: "Home page description", detail: "A synthetic home page used only in tests." }]);
  });

  it('shows "Data not available." for pages when the sitemap lists no pages', async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: xml(urlset([])) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Pages in sitemap")).toBe("Data not available.");
  });

  it("stays connected when sitemap.xml cannot be reached", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [`${SITE}/sitemap.xml`]: "network-error" }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(metric(snap, "Pages in sitemap")).toBe("Data not available.");
  });

  it("returns an error with a plain message when the home page answers 500, and skips the sitemap", async () => {
    const { fetchImpl, calls } = routedFetch(healthySite(SITE, { [SITE]: html("<html><body>Internal Server Error</body></html>", 500) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls.map((c) => c.url)).toEqual([`${SITE}/robots.txt`, SITE]);
    expect(snap.channel).toBe("website");
    expect(snap.status).toBe("error");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.message).toBe("The service answered 500.");
    expect(snap.message).not.toContain("<html>");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
  });

  it.each([[401], [403]])("explains an HTTP %i from the website as the site refusing the reader, not as a token problem", async (status) => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [SITE]: html("<html>Forbidden</html>", status) }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe(`The website refused the request (HTTP ${status}). It may block automated readers or this network. Open the site in a browser to check it is up.`);
    expect(snap.message).not.toMatch(/token/i);
  });

  it("says to check WEBSITE_URL when the home page is not found", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [SITE]: notFound() }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.message).toBe("The website home page was not found (HTTP 404). Check WEBSITE_URL in .env.local.");
  });

  it("returns an error with a plain message when the home page cannot be reached", async () => {
    const { fetchImpl } = routedFetch(healthySite(SITE, { [SITE]: "network-error" }));
    const snap = await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
  });

  it("never uses POST, even when the site has a sitemap index and a missing robots.txt", async () => {
    const routes = healthySite(SITE, {
      [`${SITE}/robots.txt`]: notFound(),
      [`${SITE}/sitemap.xml`]: xml(sitemapIndexXml([`${SITE}/sitemap-1.xml`])),
      [`${SITE}/sitemap-1.xml`]: xml(urlset([{ loc: `${SITE}/products/eggs`, lastmod: "2026-09-10" }])),
    });
    const { fetchImpl, calls } = routedFetch(routes);
    await websiteSnapshot({ env: { WEBSITE_URL: SITE }, fetchImpl, now: NOW });
    expect(calls).toHaveLength(4);
    expectOnlyGet(calls);
  });
});
