// Reads channel settings from environment variables (.env.local on the user's computer).
// Nothing here is ever sent to the browser.
import { DATA_NOT_AVAILABLE } from "../constants";

export const GRAPH_VERSION = "v21.0";
export const DEFAULT_WEBSITE_URL = "https://www.klongphaifarm.com";

const v = (env: Record<string, string | undefined>, key: string) => (env[key] ?? "").trim().replace(/^["']|["']$/g, "");

/** "Low stock" threshold: a whole number of 0 or more, otherwise the default of 5. */
function lowStockSetting(raw: string): number {
  const n = Number(raw);
  return raw !== "" && Number.isInteger(n) && n >= 0 ? n : 5;
}

export function channelConfig(env: Record<string, string | undefined> = process.env) {
  return {
    website: { url: v(env, "WEBSITE_URL") || DEFAULT_WEBSITE_URL },
    meta: { pageId: v(env, "META_PAGE_ID"), token: v(env, "META_PAGE_ACCESS_TOKEN"), igUserId: v(env, "META_IG_USER_ID") },
    line: { token: v(env, "LINE_CHANNEL_ACCESS_TOKEN") },
    // The key is either a file path (on your own computer) or the key file's contents (on a host such as Vercel).
    ga4: { propertyId: v(env, "GA4_PROPERTY_ID"), keyFile: v(env, "GA4_SERVICE_ACCOUNT_JSON_PATH"), keyJson: (env.GA4_SERVICE_ACCOUNT_JSON ?? "").trim() },
    shop: {
      platform: v(env, "SHOP_PLATFORM").toLowerCase() as "" | "shopify" | "woocommerce",
      url: v(env, "SHOP_URL").replace(/\/+$/, ""),
      key: v(env, "SHOP_API_KEY"),
      secret: v(env, "SHOP_API_SECRET"),
      lowStock: lowStockSetting(v(env, "SHOP_LOW_STOCK")),
    },
  };
}

/** Formats a whole number with thousands separators. */
export const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat("en-US").format(n) : DATA_NOT_AVAILABLE);

const fromCode = (n: number) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
};

/** Turns HTML text such as "Farm &#8211; Eggs &amp; Chicken" back into plain text. "&amp;" goes last so "&amp;lt;" stays "&lt;". */
export function decodeEntities(text: string): string {
  return text
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&#(\d+);/g, (_, d: string) => fromCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => fromCode(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** ISO timestamp -> YYYY-MM-DD in Thailand time. */
export function thaiDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
