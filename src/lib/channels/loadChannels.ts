// Reads every channel in parallel (server-only). Never throws: each channel
// reports connected / not_configured / error. Results are kept for 15 minutes
// so the services are not asked on every click.
import { ga4Snapshot } from "./ga4";
import { lineSnapshot } from "./line";
import { facebookSnapshot, instagramSnapshot } from "./meta";
import { shopSnapshot } from "./shop";
import type { ChannelDeps, ChannelSnapshot } from "./types";
import { websiteSnapshot } from "./website";

export const CACHE_MS = 15 * 60 * 1000;

const adapters = [
  { id: "website", label: "Website", run: websiteSnapshot },
  { id: "ga4", label: "Website traffic (GA4)", run: ga4Snapshot },
  { id: "shop", label: "Shop (products & stock)", run: shopSnapshot },
  { id: "facebook", label: "Facebook", run: facebookSnapshot },
  { id: "instagram", label: "Instagram", run: instagramSnapshot },
  { id: "line", label: "LINE OA", run: lineSnapshot },
] as const;

export async function readChannels(deps: ChannelDeps): Promise<ChannelSnapshot[]> {
  const results = await Promise.allSettled(adapters.map((a) => a.run(deps)));
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { channel: adapters[i].id, label: adapters[i].label, status: "error", metrics: [], items: [], message: "Something went wrong while reading this channel." },
  );
}

let cached: { at: number; key: string; value: Promise<ChannelSnapshot[]> } | null = null;

/** Channel snapshots for pages. Cached for 15 minutes per configuration. */
export function loadChannels(env: Record<string, string | undefined> = process.env, now = Date.now()): Promise<ChannelSnapshot[]> {
  const key = ["WEBSITE_URL", "META_PAGE_ID", "META_PAGE_ACCESS_TOKEN", "META_IG_USER_ID", "LINE_CHANNEL_ACCESS_TOKEN", "GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON_PATH", "SHOP_PLATFORM", "SHOP_URL", "SHOP_API_KEY", "SHOP_API_SECRET", "SHOP_LOW_STOCK", "CHANNELS_DISABLED"].map((k) => env[k] ?? "").join("|");
  if (cached && cached.key === key && now - cached.at < CACHE_MS) return cached.value;
  const value = env.CHANNELS_DISABLED === "1" ? Promise.resolve(disabledSnapshots()) : readChannels({ env, now: new Date(now) });
  cached = { at: now, key, value };
  return value;
}

/** For tests and offline use: every channel "not connected", no network calls. */
export function disabledSnapshots(): ChannelSnapshot[] {
  return adapters.map((a) => ({ channel: a.id, label: a.label, status: "not_configured", metrics: [], items: [], message: "Channel reading is turned off (CHANNELS_DISABLED=1)." }));
}

export function resetChannelCache(): void {
  cached = null;
}
