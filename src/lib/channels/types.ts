import type { Product } from "../types";

// Read-only snapshots of the brand's own channels. Built on the server; safe to
// pass to the browser (they never contain tokens or other secrets).

export type ChannelId = "website" | "ga4" | "shop" | "facebook" | "instagram" | "line";

export interface ChannelMetric {
  label: string;
  value: string;
  note?: string;
}

export interface ChannelItem {
  id: string;
  title: string;
  date?: string; // YYYY-MM-DD
  url?: string;
  detail?: string;
}

export interface ChannelSnapshot {
  channel: ChannelId;
  label: string;
  status: "connected" | "not_configured" | "error";
  /** ISO timestamp of the read, when connected or errored. */
  fetchedAt?: string;
  metrics: ChannelMetric[];
  items: ChannelItem[];
  /** Plain-language explanation for errors or what is missing. */
  message?: string;
  /** Shop only: the product list (read-only). */
  products?: Product[];
}

/** Everything an adapter needs, injected so tests never touch the network. */
export interface ChannelDeps {
  env: Record<string, string | undefined>;
  fetchImpl?: import("./readOnlyFetch").FetchLike;
  now?: Date;
  readFile?: (path: string) => Promise<string>;
}
