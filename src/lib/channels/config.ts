// Reads channel settings from environment variables (.env.local on the user's computer).
// Nothing here is ever sent to the browser.

export const GRAPH_VERSION = "v21.0";
export const DEFAULT_WEBSITE_URL = "https://www.klongphaifarm.com";

const v = (env: Record<string, string | undefined>, key: string) => (env[key] ?? "").trim().replace(/^["']|["']$/g, "");

export function channelConfig(env: Record<string, string | undefined> = process.env) {
  return {
    website: { url: v(env, "WEBSITE_URL") || DEFAULT_WEBSITE_URL },
    meta: { pageId: v(env, "META_PAGE_ID"), token: v(env, "META_PAGE_ACCESS_TOKEN"), igUserId: v(env, "META_IG_USER_ID") },
    line: { token: v(env, "LINE_CHANNEL_ACCESS_TOKEN") },
    ga4: { propertyId: v(env, "GA4_PROPERTY_ID"), keyFile: v(env, "GA4_SERVICE_ACCOUNT_JSON_PATH") },
    shop: {
      platform: v(env, "SHOP_PLATFORM").toLowerCase() as "" | "shopify" | "woocommerce",
      url: v(env, "SHOP_URL").replace(/\/+$/, ""),
      key: v(env, "SHOP_API_KEY"),
      secret: v(env, "SHOP_API_SECRET"),
      lowStock: Number(v(env, "SHOP_LOW_STOCK") || 5),
    },
  };
}

/** Formats a whole number with thousands separators. */
export const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat("en-US").format(n) : "Data not available.");

/** ISO timestamp -> YYYY-MM-DD in Thailand time. */
export function thaiDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
