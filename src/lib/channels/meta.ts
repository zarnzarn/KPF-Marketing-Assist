// Facebook Page and Instagram (Business) via the official Graph API. Read-only GET requests.
import { DATA_NOT_AVAILABLE } from "../constants";
import { GRAPH_VERSION, channelConfig, num, thaiDate } from "./config";
import { explain, readOnlyJson } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";

const graph = (path: string) => `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;

export async function facebookSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { pageId, token } = channelConfig(deps.env).meta;
  const base = { channel: "facebook" as const, label: "Facebook", metrics: [], items: [] };
  if (!pageId || !token) return { ...base, status: "not_configured", message: "Add META_PAGE_ID and META_PAGE_ACCESS_TOKEN to .env.local." };
  const req = { headers: { Authorization: `Bearer ${token}` }, secrets: [token], fetchImpl: deps.fetchImpl };
  const fetchedAt = (deps.now ?? new Date()).toISOString();
  try {
    const page = await readOnlyJson<{ name?: string; followers_count?: number; fan_count?: number }>(graph(`${encodeURIComponent(pageId)}?fields=name,followers_count,fan_count`), req);
    const posts = await readOnlyJson<{ data?: { id: string; message?: string; created_time?: string; permalink_url?: string }[] }>(
      graph(`${encodeURIComponent(pageId)}/posts?fields=message,created_time,permalink_url&limit=5`),
      req,
    );
    return {
      ...base,
      status: "connected",
      fetchedAt,
      metrics: [
        { label: "Page", value: page.name ?? DATA_NOT_AVAILABLE },
        { label: "Followers", value: num(page.followers_count) },
        { label: "Page likes", value: num(page.fan_count) },
      ],
      items: (posts.data ?? []).map((p) => ({ id: p.id, title: (p.message ?? "(post without text)").slice(0, 160), date: thaiDate(p.created_time), url: p.permalink_url })),
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt, message: explain(error) };
  }
}

export async function instagramSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { igUserId, token } = channelConfig(deps.env).meta;
  const base = { channel: "instagram" as const, label: "Instagram", metrics: [], items: [] };
  if (!igUserId || !token) return { ...base, status: "not_configured", message: "Add META_IG_USER_ID and META_PAGE_ACCESS_TOKEN to .env.local (Instagram must be a Business or Creator account linked to the Facebook Page)." };
  const req = { headers: { Authorization: `Bearer ${token}` }, secrets: [token], fetchImpl: deps.fetchImpl };
  const fetchedAt = (deps.now ?? new Date()).toISOString();
  try {
    const user = await readOnlyJson<{ username?: string; followers_count?: number; media_count?: number }>(graph(`${encodeURIComponent(igUserId)}?fields=username,followers_count,media_count`), req);
    const media = await readOnlyJson<{ data?: { id: string; caption?: string; timestamp?: string; permalink?: string; like_count?: number; comments_count?: number }[] }>(
      graph(`${encodeURIComponent(igUserId)}/media?fields=caption,timestamp,permalink,like_count,comments_count&limit=5`),
      req,
    );
    return {
      ...base,
      status: "connected",
      fetchedAt,
      metrics: [
        { label: "Account", value: user.username ? `@${user.username}` : DATA_NOT_AVAILABLE },
        { label: "Followers", value: num(user.followers_count) },
        { label: "Posts", value: num(user.media_count) },
      ],
      items: (media.data ?? []).map((m) => ({
        id: m.id,
        title: (m.caption ?? "(post without caption)").slice(0, 160),
        date: thaiDate(m.timestamp),
        url: m.permalink,
        // Each number has its own label, so a missing one reads "Likes: Data not available." in full.
        detail: `Likes: ${num(m.like_count)} · Comments: ${num(m.comments_count)}`,
      })),
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt, message: explain(error) };
  }
}
