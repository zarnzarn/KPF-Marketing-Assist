// LINE Official Account via the official Messaging API. Read-only GET requests.
// Note: the lin.ee invite link is not an API. This needs a channel access token.
import { DATA_NOT_AVAILABLE } from "../constants";
import { channelConfig, num } from "./config";
import { explain, readOnlyJson } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";

/** Yesterday in Thailand as yyyyMMdd (LINE statistics are ready for past days only). */
export function lineStatsDate(now: Date): string {
  return new Date(now.getTime() + 7 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
}

export async function lineSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { token } = channelConfig(deps.env).line;
  const base = { channel: "line" as const, label: "LINE OA", metrics: [], items: [] };
  if (!token) return { ...base, status: "not_configured", message: "Add LINE_CHANNEL_ACCESS_TOKEN to .env.local (from LINE Developers, Messaging API channel)." };
  const now = deps.now ?? new Date();
  const req = { headers: { Authorization: `Bearer ${token}` }, secrets: [token], fetchImpl: deps.fetchImpl };
  try {
    const info = await readOnlyJson<{ displayName?: string; basicId?: string }>("https://api.line.me/v2/bot/info", req);
    const date = lineStatsDate(now);
    const stats = await readOnlyJson<{ status?: string; followers?: number; targetedReaches?: number; blocks?: number }>(`https://api.line.me/v2/bot/insight/followers?date=${date}`, req);
    const ready = stats.status === "ready";
    const asOf = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`;
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Account", value: info.displayName ?? info.basicId ?? DATA_NOT_AVAILABLE },
        { label: "Friends", value: ready ? num(stats.followers) : DATA_NOT_AVAILABLE, note: ready ? `as of ${asOf}` : "LINE has not prepared statistics for this day" },
        { label: "Targeted reach", value: ready ? num(stats.targetedReaches) : DATA_NOT_AVAILABLE },
        { label: "Blocked", value: ready ? num(stats.blocks) : DATA_NOT_AVAILABLE },
      ],
      items: [],
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: explain(error) };
  }
}
