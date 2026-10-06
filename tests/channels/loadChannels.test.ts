import { act, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { ga4Snapshot } from "@/lib/channels/ga4";
import { CACHE_MS, disabledSnapshots, loadChannels, readChannels, resetChannelCache } from "@/lib/channels/loadChannels";
import type { FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelId, ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic. No real accounts, names or tokens.
// The network is never used: adapters get an injected fetchImpl, and the global
// fetch is replaced by a spy that fails the request if anything reaches it.

// The Channels page calls loadChannels(). The page tests (at the bottom) hand it
// synthetic snapshots through `pageData`; every other test uses the real function.
const pageData = vi.hoisted(() => ({ snapshots: null as ChannelSnapshot[] | null }));

vi.mock("@/lib/channels/loadChannels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/channels/loadChannels")>();
  return {
    ...actual,
    loadChannels: vi.fn((...args: Parameters<typeof actual.loadChannels>) => (pageData.snapshots ? Promise.resolve(pageData.snapshots) : actual.loadChannels(...args))),
  };
});

// Lets one test make the GA4 adapter throw unexpectedly. Otherwise it is the real adapter.
vi.mock("@/lib/channels/ga4", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/channels/ga4")>();
  return { ...actual, ga4Snapshot: vi.fn(actual.ga4Snapshot) };
});

import ChannelsPage from "@/app/channels/page";

const META_TOKEN = "EAAfake-token-1234567890";
const LINE_TOKEN = "test-token-1234567890";
const SHOP_TOKEN = "shpat_fake-secret-abcdef";
// 2026-10-06 10:00 in Thailand.
const NOW = new Date("2026-10-06T03:00:00.000Z");
const T = NOW.getTime();

const ORDER: ChannelId[] = ["website", "ga4", "shop", "facebook", "instagram", "line"];
const LABELS = ["Website", "Website traffic (GA4)", "Shop (products & stock)", "Facebook", "Instagram", "LINE OA"];

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

/** A fake fetch that records every call and always fails, echoing the request headers (which hold the tokens). */
function failingFetch() {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const headers = { ...((init?.headers as Record<string, string>) ?? {}) };
    calls.push({ url, method: init?.method, headers, body: init?.body });
    throw new Error(`connection reset while sending ${JSON.stringify(headers)}`);
  };
  return { fetchImpl, calls };
}

/** Every channel setting filled with synthetic values. */
const fullEnv = (extra: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
  WEBSITE_URL: "https://www.example.com",
  META_PAGE_ID: "100000000000001",
  META_PAGE_ACCESS_TOKEN: META_TOKEN,
  META_IG_USER_ID: "17800000000000001",
  LINE_CHANNEL_ACCESS_TOKEN: LINE_TOKEN,
  SHOP_PLATFORM: "shopify",
  SHOP_URL: "https://fake-shop.myshopify.com",
  SHOP_API_KEY: SHOP_TOKEN,
  ...extra,
});

function expectNoSecrets(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const secret of [META_TOKEN, LINE_TOKEN, SHOP_TOKEN]) expect(text).not.toContain(secret);
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  resetChannelCache();
  pageData.snapshots = null;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed (blocked in tests)"));
});

afterEach(() => {
  fetchSpy.mockRestore();
  pageData.snapshots = null;
  resetChannelCache();
});

describe("readChannels", () => {
  it("returns six snapshots in a fixed order: website, ga4, shop, facebook, instagram, line", async () => {
    const { fetchImpl } = failingFetch();
    const snaps = await readChannels({ env: {}, fetchImpl, now: NOW });
    expect(snaps.map((s) => s.channel)).toEqual(ORDER);
    expect(snaps.map((s) => s.label)).toEqual(LABELS);
  });

  it("never throws when nothing is set up and every request fails", async () => {
    const { fetchImpl, calls } = failingFetch();
    const readFile = vi.fn(async () => {
      throw new Error("no such file");
    });
    const snaps = await readChannels({ env: {}, fetchImpl, now: NOW, readFile });
    for (const s of snaps) expect(["not_configured", "error"]).toContain(s.status);
    for (const s of snaps) {
      expect(s.metrics).toEqual([]);
      expect(s.items).toEqual([]);
      expect(typeof s.message).toBe("string");
    }
    // Only the public website has a default address, so only it is read (and fails).
    expect(snaps.find((s) => s.channel === "website")?.status).toBe("error");
    for (const id of ["ga4", "shop", "facebook", "instagram", "line"]) expect(snaps.find((s) => s.channel === id)?.status).toBe("not_configured");
    expect(readFile).not.toHaveBeenCalled();
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.url.startsWith("https://www.klongphaifarm.com")).toBe(true);
      expect(call.method).toBe("GET");
      expect(call.body).toBeUndefined();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports every configured channel as a problem, without tokens, when every request fails", async () => {
    const { fetchImpl, calls } = failingFetch();
    const snaps = await readChannels({ env: fullEnv(), fetchImpl, now: NOW });
    expect(snaps.map((s) => [s.channel, s.status])).toEqual([
      ["website", "error"],
      ["ga4", "not_configured"],
      ["shop", "error"],
      ["facebook", "error"],
      ["instagram", "error"],
      ["line", "error"],
    ]);
    // The fake fetch echoed the Authorization headers into its error; none of it may reach the snapshot.
    expectNoSecrets(snaps);
    for (const s of snaps.filter((x) => x.status === "error")) expect(s.fetchedAt).toBe(NOW.toISOString());

    // Read-only: GET everywhere, except the allow-listed Shopify GraphQL query.
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.url)).toEqual(["https://fake-shop.myshopify.com/admin/api/2025-01/graphql.json"]);
    expect(String(posts[0].body)).not.toMatch(/\bmutation\b/i);
    for (const call of calls.filter((c) => c.method !== "POST")) {
      expect(call.method).toBe("GET");
      expect(call.body).toBeUndefined();
    }
    expect(calls.some((c) => c.url === "https://www.example.com/robots.txt")).toBe(true);
    expect(calls.some((c) => c.url.startsWith("https://graph.facebook.com/") && c.headers.Authorization === `Bearer ${META_TOKEN}`)).toBe(true);
    expect(calls.some((c) => c.url === "https://api.line.me/v2/bot/info" && c.headers.Authorization === `Bearer ${LINE_TOKEN}`)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("turns an adapter that throws into a plain error snapshot and keeps the other channels", async () => {
    vi.mocked(ga4Snapshot).mockRejectedValueOnce(new Error(`unexpected crash with ${LINE_TOKEN}`));
    const { fetchImpl } = failingFetch();
    const snaps = await readChannels({ env: {}, fetchImpl, now: NOW });
    expect(snaps).toHaveLength(6);
    expect(snaps[1]).toEqual({ channel: "ga4", label: "Website traffic (GA4)", status: "error", metrics: [], items: [], message: "Something went wrong while reading this channel." });
    expect(snaps.map((s) => s.channel)).toEqual(ORDER);
    expect(snaps.find((s) => s.channel === "line")?.status).toBe("not_configured");
    expectNoSecrets(snaps);
  });
});

describe("disabledSnapshots", () => {
  it("lists all six channels as not connected, with nothing read", () => {
    const snaps = disabledSnapshots();
    expect(snaps.map((s) => s.channel)).toEqual(ORDER);
    expect(snaps.map((s) => s.label)).toEqual(LABELS);
    for (const s of snaps) {
      expect(s.status).toBe("not_configured");
      expect(s.metrics).toEqual([]);
      expect(s.items).toEqual([]);
      expect(s.fetchedAt).toBeUndefined();
      expect(s.message).toContain("CHANNELS_DISABLED=1");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns fresh objects each time", () => {
    const a = disabledSnapshots();
    a[0].metrics.push({ label: "changed", value: "1" });
    expect(disabledSnapshots()[0].metrics).toEqual([]);
  });
});

describe("loadChannels", () => {
  it("makes no network calls and reports every channel as not connected when CHANNELS_DISABLED=1", async () => {
    const snaps = await loadChannels(fullEnv({ CHANNELS_DISABLED: "1" }), T);
    expect(snaps).toEqual(disabledSnapshots());
    expect(fetchSpy).not.toHaveBeenCalled();
    expectNoSecrets(snaps);
  });

  it("uses the test settings (CHANNELS_DISABLED=1) when called without arguments, so tests never go online", async () => {
    expect(process.env.CHANNELS_DISABLED).toBe("1");
    const snaps = await loadChannels();
    expect(snaps).toEqual(disabledSnapshots());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the channels when not disabled, and still never throws when the internet is unreachable", async () => {
    const snaps = await loadChannels({}, T);
    expect(snaps.map((s) => s.channel)).toEqual(ORDER);
    for (const s of snaps) expect(["not_configured", "error"]).toContain(s.status);
    expect(snaps[0].status).toBe("error");
    // Only the public website (default address) was tried, through the read-only GET path.
    expect(fetchSpy).toHaveBeenCalled();
    for (const [url, init] of fetchSpy.mock.calls) {
      expect(String(url).startsWith("https://www.klongphaifarm.com")).toBe(true);
      expect(init?.method).toBe("GET");
    }
  });

  describe("cache", () => {
    const env = fullEnv({ CHANNELS_DISABLED: "1" });

    it("keeps the cache for 15 minutes", () => {
      expect(CACHE_MS).toBe(15 * 60 * 1000);
    });

    it("returns the same promise for the same settings within 15 minutes", () => {
      const first = loadChannels(env, T);
      expect(loadChannels(env, T)).toBe(first);
      expect(loadChannels({ ...env }, T + 60_000)).toBe(first);
      expect(loadChannels(env, T + CACHE_MS - 1)).toBe(first);
    });

    it("reads again once 15 minutes have passed", () => {
      const first = loadChannels(env, T);
      const later = loadChannels(env, T + CACHE_MS);
      expect(later).not.toBe(first);
      // The new result is now the cached one.
      expect(loadChannels(env, T + CACHE_MS + 1)).toBe(later);
    });

    it("reads again when a channel setting changes", () => {
      const first = loadChannels(env, T);
      const changed = loadChannels({ ...env, META_PAGE_ID: "100000000000002" }, T + 1);
      expect(changed).not.toBe(first);
      expect(loadChannels({ ...env, META_PAGE_ID: "100000000000002" }, T + 2)).toBe(changed);
      expect(loadChannels({ ...env, LINE_CHANNEL_ACCESS_TOKEN: "test-token-0987654321" }, T + 3)).not.toBe(changed);
    });

    it("reads again when CHANNELS_DISABLED is switched", async () => {
      const disabled = loadChannels(env, T);
      const enabled = loadChannels({ ...env, CHANNELS_DISABLED: "" }, T + 1);
      expect(enabled).not.toBe(disabled);
      await enabled; // the failing global fetch spy answers; nothing goes online
    });

    it("reads again when SHOP_LOW_STOCK changes", () => {
      const first = loadChannels({ ...env, SHOP_LOW_STOCK: "5" }, T);
      expect(loadChannels({ ...env, SHOP_LOW_STOCK: "20" }, T + 1)).not.toBe(first);
    });

    it("ignores settings that have nothing to do with channels", () => {
      const first = loadChannels(env, T);
      expect(loadChannels({ ...env, REPORTS_DIR: "/somewhere/else" }, T + 1)).toBe(first);
    });

    it("is cleared by resetChannelCache()", () => {
      const first = loadChannels(env, T);
      resetChannelCache();
      expect(loadChannels(env, T)).not.toBe(first);
    });

    it("never calls the network for cached or disabled reads", async () => {
      await loadChannels(env, T);
      await loadChannels(env, T + 1000);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Static guards: read the source files and check the read-only rules hold.
// ---------------------------------------------------------------------------

// Tests run from the project folder (like tests/no-private-data.test.ts).
const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(full);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const files = codeFiles(SRC).map((file) => ({ file: rel(file), text: readFileSync(file, "utf8") }));

const FETCH_CALL = /\bfetch\s*\(/;
const WRITE_METHOD = /method\s*:\s*["'`](PUT|DELETE|PATCH)["'`]/i;
const USE_CLIENT = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*["']use client["']/;

/** Static imports, re-exports and dynamic imports in a source file. */
function importsOf(text: string): { specifier: string; typeOnly: boolean }[] {
  const found: { specifier: string; typeOnly: boolean }[] = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm)) found.push({ specifier: m[2], typeOnly: Boolean(m[1]) });
  for (const m of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) found.push({ specifier: m[1], typeOnly: false });
  return found;
}

const isChannelsModule = (specifier: string) => /(^|\/)channels\//.test(specifier);

describe("read-only source guards", () => {
  it("finds the source files to check", () => {
    const names = files.map((f) => f.file);
    expect(names).toContain("src/lib/channels/readOnlyFetch.ts");
    expect(names).toContain("src/app/channels/page.tsx");
    expect(names.length).toBeGreaterThan(20);
  });

  it("calls fetch( only in src/lib/channels/readOnlyFetch.ts", () => {
    // The pattern itself must work: readOnlyFetch.ts does call fetch(.
    expect(files.find((f) => f.file === "src/lib/channels/readOnlyFetch.ts")?.text).toMatch(FETCH_CALL);
    // And it must not confuse fetchImpl( or readOnlyFetch( with fetch(.
    expect("deps.fetchImpl(url); readOnlyFetch(url); doFetch(url)").not.toMatch(FETCH_CALL);
    const offenders = files.filter((f) => f.file !== "src/lib/channels/readOnlyFetch.ts" && FETCH_CALL.test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it("never uses PUT, DELETE or PATCH requests", () => {
    expect(`method: "PUT"`).toMatch(WRITE_METHOD);
    expect(`method:'delete'`).toMatch(WRITE_METHOD);
    expect("method: `PATCH`").toMatch(WRITE_METHOD);
    expect(files.filter((f) => WRITE_METHOD.test(f.text)).map((f) => f.file)).toEqual([]);
  });

  it("browser (use client) files only import channel types, never channel code", () => {
    const clientFiles = files.filter((f) => USE_CLIENT.test(f.text));
    expect(clientFiles.length).toBeGreaterThan(0);
    const offenders = clientFiles.flatMap((f) =>
      importsOf(f.text)
        .filter((imp) => isChannelsModule(imp.specifier))
        .filter((imp) => !(imp.typeOnly && /(^|\/)channels\/types$/.test(imp.specifier)))
        .map((imp) => `${f.file} -> ${imp.specifier}${imp.typeOnly ? " (type)" : ""}`),
    );
    expect(offenders).toEqual([]);
  });

  it("detects the kinds of imports the browser rule looks for", () => {
    const sample = [
      `import type { ChannelSnapshot } from "@/lib/channels/types";`,
      `import { loadChannels } from "@/lib/channels/loadChannels";`,
      `import {\n  explain,\n  readOnlyJson,\n} from "../channels/readOnlyFetch";`,
      `const m = await import("@/lib/channels/meta");`,
    ].join("\n");
    expect(importsOf(sample).filter((i) => isChannelsModule(i.specifier))).toEqual([
      { specifier: "@/lib/channels/types", typeOnly: true },
      { specifier: "@/lib/channels/loadChannels", typeOnly: false },
      { specifier: "../channels/readOnlyFetch", typeOnly: false },
      { specifier: "@/lib/channels/meta", typeOnly: false },
    ]);
    expect(USE_CLIENT.test(`// comment\n"use client";\nimport x from "y";`)).toBe(true);
    expect(USE_CLIENT.test(`import x from "y";\nconst s = "use client";`)).toBe(false);
  });

  it("has no console logging in src/lib/channels (tokens could end up in logs)", () => {
    const channelFiles = files.filter((f) => f.file.startsWith("src/lib/channels/"));
    expect(channelFiles.length).toBeGreaterThanOrEqual(8);
    expect(channelFiles.filter((f) => /\bconsole\s*\./.test(f.text)).map((f) => f.file)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The Channels page, rendered with synthetic snapshots.
// ---------------------------------------------------------------------------

const connectedSnap: ChannelSnapshot = {
  channel: "instagram",
  label: "Instagram",
  status: "connected",
  fetchedAt: "2026-10-06T03:00:00.000Z",
  metrics: [
    { label: "Account", value: "@synthetic_test_account" },
    { label: "Followers", value: "1,234", note: "Synthetic follower note" },
    { label: "Posts", value: "56" },
  ],
  items: [
    { id: "post-1", title: "Synthetic post one", date: "2026-10-01", url: "https://www.instagram.com/p/FAKE0001/", detail: "12 likes · 3 comments" },
    { id: "post-2", title: "Synthetic post without link", date: "2026-09-28" },
  ],
};

const notConfiguredSnap: ChannelSnapshot = {
  channel: "line",
  label: "LINE OA",
  status: "not_configured",
  metrics: [],
  items: [],
  message: "Add LINE_CHANNEL_ACCESS_TOKEN to .env.local (from LINE Developers, Messaging API channel).",
};

const ERROR_MESSAGE = "The access token was refused or has expired. Create a new one and update .env.local. (The service answered 401: Invalid OAuth access token.)";
const errorSnap: ChannelSnapshot = {
  channel: "facebook",
  label: "Facebook",
  status: "error",
  fetchedAt: "2026-10-06T03:00:00.000Z",
  metrics: [],
  items: [],
  message: ERROR_MESSAGE,
};

async function renderChannelsPage(snapshots: ChannelSnapshot[]) {
  pageData.snapshots = snapshots;
  const ui = await ChannelsPage();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(createElement("main", null, ui));
  });
  return result;
}

describe("Channels page", () => {
  const snapshots = [connectedSnap, notConfiguredSnap, errorSnap];

  it("shows the heading and how many channels are connected", async () => {
    await renderChannelsPage(snapshots);
    expect(loadChannels).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Channels" })).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 channels connected/)).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("shows a status badge on every card", async () => {
    await renderChannelsPage(snapshots);
    expect(within(screen.getByRole("region", { name: "Instagram" })).getByText("Connected (read-only)")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "LINE OA" })).getByText("Not connected")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Facebook" })).getByText("Problem")).toBeInTheDocument();
  });

  it("shows the metrics, read time and items of a connected channel", async () => {
    await renderChannelsPage(snapshots);
    const card = within(screen.getByRole("region", { name: "Instagram" }));
    for (const [label, value] of [
      ["Account", "@synthetic_test_account"],
      ["Followers", "1,234"],
      ["Posts", "56"],
    ]) {
      const term = card.getByText(label);
      expect(term.tagName).toBe("DT");
      expect(term.parentElement).toHaveTextContent(value);
    }
    expect(card.getByText("Synthetic follower note")).toBeInTheDocument();
    expect(card.getByText("Read 6 Oct 10:00 (Thailand time)")).toBeInTheDocument();
    expect(card.getByText("1 Oct · 12 likes · 3 comments")).toBeInTheDocument();
    expect(card.getByText("28 Sep")).toBeInTheDocument();
  });

  it("opens item links safely in a new tab", async () => {
    await renderChannelsPage(snapshots);
    const card = within(screen.getByRole("region", { name: "Instagram" }));
    const link = card.getByRole("link", { name: /Synthetic post one/ });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/p/FAKE0001/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link).toHaveTextContent("(opens in a new tab)");
    // An item without an address is plain text, not a link.
    expect(card.getByText("Synthetic post without link")).toBeInTheDocument();
    expect(card.queryByRole("link", { name: /Synthetic post without link/ })).toBeNull();
    for (const a of screen.getAllByRole("link")) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
  });

  it("shows the problem message and no numbers for a channel with an error", async () => {
    await renderChannelsPage(snapshots);
    const region = screen.getByRole("region", { name: "Facebook" });
    expect(within(region).getByText(ERROR_MESSAGE)).toBeInTheDocument();
    expect(region.querySelector("dl")).toBeNull();
    expect(region.querySelector("a")).toBeNull();
  });

  it("shows what is missing and no numbers for a channel that is not connected", async () => {
    await renderChannelsPage(snapshots);
    const region = screen.getByRole("region", { name: "LINE OA" });
    expect(within(region).getByText(notConfiguredSnap.message!)).toBeInTheDocument();
    expect(region.querySelector("dl")).toBeNull();
  });

  it("gives every card a 'How to connect' section", async () => {
    await renderChannelsPage(snapshots);
    for (const region of screen.getAllByRole("region")) {
      const summary = within(region).getByText("How to connect");
      expect(summary.tagName).toBe("SUMMARY");
      expect(summary.parentElement?.tagName).toBe("DETAILS");
    }
    expect(within(screen.getByRole("region", { name: "LINE OA" })).getByText(/LINE_CHANNEL_ACCESS_TOKEN=\.\.\./)).toBeInTheDocument();
  });

  it("never shows a token, even one that slipped into a field the page does not use", async () => {
    const leaky: ChannelSnapshot & { debug: Record<string, string> } = {
      ...connectedSnap,
      debug: { authorization: `Bearer ${META_TOKEN}`, shopToken: SHOP_TOKEN, lineToken: LINE_TOKEN },
    };
    const { container } = await renderChannelsPage([leaky, notConfiguredSnap, errorSnap]);
    expectNoSecrets(container.textContent ?? "");
    expectNoSecrets(container.innerHTML);
    expect(container.textContent).not.toMatch(/EAA|shpat_|Bearer /);
    const elementsWithTokens = Array.from(container.querySelectorAll("*")).filter((el) => /EAA|shpat_|Bearer /.test(el.textContent ?? ""));
    expect(elementsWithTokens).toEqual([]);
    expect(container.textContent).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderChannelsPage(snapshots);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });
});
